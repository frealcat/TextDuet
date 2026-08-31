import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const playwrightModule = await import(process.env.PLAYWRIGHT_ENTRY);
const { chromium } = playwrightModule.default ?? playwrightModule;
const builtExtensionDir = process.env.EXTENSION_DIR;
const chromeExecutable = process.env.CHROME_EXECUTABLE;
const fixtureUrl = process.env.FIXTURE_URL || 'http://127.0.0.1:8765/multilingual.html';
const smokeApiKey = process.env.TEXTDUET_SMOKE_API_KEY || 'test-only-placeholder';
const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
const fixtureHostPermission = new URL('/', fixtureUrl).href + '*';

assert(builtExtensionDir && chromeExecutable);
const harnessDir = await mkdtemp(resolve('.playwright/browser-profile/smoke-'));
const extensionDir = resolve(harnessDir, 'extension');
const profileDir = process.env.CHROME_PROFILE || resolve(harnessDir, 'profile');
await prepareSmokeExtension(builtExtensionDir, extensionDir, fixtureHostPermission);

let context;

try {
  context = await chromium.launchPersistentContext(profileDir, {
    executablePath: chromeExecutable,
    headless,
    locale: 'zh-CN',
    // Playwright normally adds --disable-extensions. Remove that default so
    // MV3 service-worker loading remains explicit across browser revisions.
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      '--enable-extensions',
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
    ],
  });
  await context.route('https://api.example.com/**', async (route) => {
    const requestBody = route.request().postDataJSON();
    const userMessage = requestBody?.messages?.find((message) => message?.role === 'user');
    const request = typeof userMessage?.content === 'string'
      ? JSON.parse(userMessage.content)
      : { blocks: [] };
    const blocks = Array.isArray(request.blocks) ? request.blocks : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        model: requestBody?.model || 'textduet-smoke-model',
        usage: { prompt_tokens: Math.max(1, blocks.length), completion_tokens: Math.max(1, blocks.length) },
        choices: [{ message: { content: JSON.stringify({
          blocks: blocks.map((block) => ({
            id: block.id,
            translatedText: `【网络译文】${block.text}`,
          })),
        }) } }],
      }),
    });
  });
  const worker = await getServiceWorker(context);
  const extensionId = new URL(worker.url()).hostname;
  const extensionOrigin = `chrome-extension://${extensionId}`;
  const fixturePage = await context.newPage();
  await fixturePage.goto(fixtureUrl);
  const sourceTexts = await collectSourceTexts(fixturePage);
  const optionsPage = await context.newPage();
  await optionsPage.goto(`${extensionOrigin}/options.html`);
  await optionsPage.getByRole('heading', { name: '连接你的翻译模型' }).waitFor();
  const smokeSettings = {
    provider: 'openai-compatible',
    baseUrl: 'https://api.example.com/v1',
    model: 'textduet-smoke-model',
    targetLanguage: 'zh-CN',
    displayMode: 'bilingual',
    customSystemPrompt: '',
  };
  await saveProviderSettingsStep(optionsPage, { ...smokeSettings, apiKeyPersistence: 'session' }, smokeApiKey);
  const vault = await optionsPage.evaluate((password) =>
    chrome.runtime.sendMessage({ type: 'CREATE_VAULT', password }), 'browser-test-vault-2026');
  if (!vault?.isUnlocked) throw new Error('test vault could not be created');
  await saveProviderSettingsStep(optionsPage, { ...smokeSettings, apiKeyPersistence: 'local' });
  const consent = await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: 'CONFIRM_TRANSLATION_CONSENT' }));
  if (!consent?.isConfirmed) throw new Error('translation consent could not be confirmed');
  await optionsPage.close();

  const providerRequests = [];
  context.on('request', (request) => {
    if (request.url().startsWith('https://api.example.com/')) providerRequests.push(request.url());
  });
  const popupPage = await context.newPage();
  await popupPage.goto(`${extensionOrigin}/popup.html`);
  await popupPage.getByRole('button', { name: '翻译当前网页' }).waitFor();
  const firstStartResult = await startFixtureTranslation(worker, popupPage, fixturePage);
  assert.deepEqual(firstStartResult, { ok: true, message: '已开始翻译当前网页' });
  await fixturePage.locator('.textduet-translation').first().waitFor({ timeout: 8_000 });
  const translatedTexts = await fixturePage.locator('.textduet-translation').allTextContents();
  assert.equal(translatedTexts.length, sourceTexts.length);
  assert(translatedTexts.every((text) => text.startsWith('【网络译文】')));
  assert(providerRequests.length > 0, 'first run must populate the encrypted cache through the provider');

  // Exercise the real tab active/inactive lifecycle. Chrome emits
  // visibilitychange when the active tab changes; returning to the fixture
  // must reconcile existing owners in place rather than append duplicates.
  await popupPage.bringToFront();
  await fixturePage.bringToFront();
  await fixturePage.waitForTimeout(350);
  assert.equal(
    await fixturePage.locator('.textduet-translation').count(),
    sourceTexts.length,
    'active/inactive tab round-trip must not duplicate translations',
  );

  const requestCountBeforeCacheHit = providerRequests.length;
  await fixturePage.reload();
  const secondStartResult = await startFixtureTranslation(worker, popupPage, fixturePage);
  assert.deepEqual(secondStartResult, { ok: true, message: '已开始翻译当前网页' });
  await fixturePage.locator('.textduet-translation').first().waitFor({ timeout: 8_000 });
  assert.equal(await fixturePage.locator('.textduet-translation').count(), sourceTexts.length);
  assert.equal(providerRequests.length, requestCountBeforeCacheHit, 'second run should reuse encrypted cache');

  await optionsPage.close().catch(() => undefined);
  const cleanupPage = await context.newPage();
  await cleanupPage.goto(`${extensionOrigin}/options.html`);
  cleanupPage.on('dialog', (dialog) => dialog.accept());
  await cleanupPage.getByRole('button', { name: '清空翻译缓存' }).click();
  await cleanupPage.getByText('本地翻译缓存已清空').waitFor();
  const clearedSummary = await cacheSummary(cleanupPage);
  assert.match(clearedSummary, /缓存条目\s*0/);

  console.log(JSON.stringify({ extensionId, sourceBlockCount: sourceTexts.length, renderedBlockCount: translatedTexts.length, providerRequests: providerRequests.length, cacheHitVerified: true, clearedSummary }, null, 2));
} finally {
  await context?.close();
  await rm(harnessDir, { recursive: true, force: true });
}

async function prepareSmokeExtension(sourceDir, targetDir, hostPermission) {
  await cp(sourceDir, targetDir, { recursive: true });
  const manifestPath = resolve(targetDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.host_permissions = [
    ...new Set([...(manifest.host_permissions || []), hostPermission]),
  ];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function getServiceWorker(browserContext) {
  const existing = browserContext.serviceWorkers()[0];
  return existing || browserContext.waitForEvent('serviceworker', { timeout: 15_000 });
}

async function saveProviderSettingsStep(page, settings, apiKey) {
  const response = await page.evaluate(({ nextSettings, key }) =>
    chrome.runtime.sendMessage({
      type: 'SAVE_PROVIDER_SETTINGS',
      settings: nextSettings,
      ...(key ? { apiKey: key } : {}),
    }), { nextSettings: settings, key: apiKey });
  if (!response?.ok) throw new Error(response?.message || 'save failed');
}

async function startFixtureTranslation(worker, popupPage, fixturePage) {
  await fixturePage.bringToFront();
  const fixtureTabId = await worker.evaluate(async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return activeTab?.id;
  });
  assert.equal(typeof fixtureTabId, 'number');

  const { activeTabId, response } = await popupPage.evaluate(async (tabId) => {
    await chrome.tabs.update(tabId, { active: true });
    await new Promise((resolve) => setTimeout(resolve, 150));
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.runtime.sendMessage({
      type: 'TRANSLATE_ACTIVE_TAB',
      targetLanguage: 'zh-CN',
    });
    return { activeTabId: activeTab?.id, response };
  }, fixtureTabId);
  assert.equal(activeTabId, fixtureTabId);
  return response;
}

async function collectSourceTexts(page) {
  return page.locator('h1, h2, h3, h4, h5, h6, p, li, blockquote, td, figcaption').evaluateAll((elements) => {
    const excluded = 'script, style, noscript, code, pre, textarea, input, select, button, form, nav, footer, menu, [contenteditable]:not([contenteditable="false"]), [aria-hidden="true"], [hidden], [inert], [role="button"], [role="navigation"], [role="menu"]';
    return elements.flatMap((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const text = (element.innerText || '').replace(/\s+/g, ' ').trim();
      if (element.closest(excluded) || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || rect.width === 0 || rect.height === 0 || text.length < 2 || text.length > 4_000) return [];
      return [text];
    });
  });
}

async function cacheSummary(page) {
  const summary = page.locator('.cache-summary');
  await summary.waitFor();
  return (await summary.textContent()) || '';
}
