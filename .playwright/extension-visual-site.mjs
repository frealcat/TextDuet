import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const playwrightEntry = process.env.PLAYWRIGHT_ENTRY;
const chromeExecutable = process.env.CHROME_EXECUTABLE;
const builtExtensionDir = resolve(process.env.EXTENSION_DIR || '.output/chrome-mv3');
const targetUrl = process.env.TEXTDUET_VISUAL_URL || 'https://www.trychroma.com/research/context-rot';
const outputDir = resolve(process.env.TEXTDUET_VISUAL_OUTPUT_DIR || 'output/playwright');
const sampleBlockLimit = 6;
const sampleCharacterLimit = 1_800;
const provider = readProviderEnvironment();

assert(playwrightEntry, 'PLAYWRIGHT_ENTRY is required');
assert(chromeExecutable, 'CHROME_EXECUTABLE is required');

const { chromium } = await import(playwrightEntry);
const targetOrigin = new URL(targetUrl).origin;
const providerOrigin = new URL(provider.baseUrl).origin;
const tempRoot = await mkdtemp(resolve('.playwright/browser-profile/visual-site-'));
const extensionDir = resolve(tempRoot, 'extension');
const profileDir = resolve(tempRoot, 'profile');
const viewportScreenshot = resolve(outputDir, 'context-rot-textduet.png');
const fullPageScreenshot = resolve(outputDir, 'context-rot-textduet-full.png');
const usageScreenshot = resolve(outputDir, 'context-rot-textduet-usage.png');
const providerRequests = [];
let context;

try {
  await mkdir(outputDir, { recursive: true });
  await prepareTestExtension(extensionDir, [
    `${providerOrigin}/*`,
    `${targetOrigin}/*`,
  ]);

  context = await chromium.launchPersistentContext(profileDir, {
    executablePath: chromeExecutable,
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
    locale: 'en-US',
    viewport: { width: 1440, height: 1100 },
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
    ],
  });
  trackProviderRequests(context, providerOrigin, providerRequests);

  const worker = context.serviceWorkers()[0]
    || await context.waitForEvent('serviceworker', { timeout: 15_000 });
  const extensionOrigin = `chrome-extension://${new URL(worker.url()).hostname}`;
  const optionsPage = await context.newPage();
  await optionsPage.goto(`${extensionOrigin}/options.html`);
  await optionsPage.getByRole('heading', { name: '连接你的翻译模型' }).waitFor();
  await saveProviderSettings(optionsPage, provider);

  const page = await context.newPage();
  const response = await page.goto(targetUrl, {
    waitUntil: 'commit',
    timeout: 60_000,
  });
  assert(response, 'Target navigation returned no response');
  assert(response.ok(), `Target returned HTTP ${response.status()}`);
  await page.locator('main h1, article h1, h1').first().waitFor({
    state: 'visible',
    timeout: 90_000,
  });
  await page.waitForTimeout(3_000);
  await page.evaluate(() => document.fonts.ready);

  const sourcePage = await page.evaluate(() => ({
    titlePresent: Boolean(document.querySelector('main h1, article h1, h1')),
    readableCharacters: (document.querySelector('main, article')?.innerText || '').length,
  }));
  assert(sourcePage.titlePresent, 'Target article heading is unavailable');
  assert(sourcePage.readableCharacters > 3_000, 'Target article body is unexpectedly short');
  const sample = await prepareVisualSample(page, sampleBlockLimit, sampleCharacterLimit);
  assert.equal(sample.selectedCount, sampleBlockLimit, 'Visual sample count mismatch');
  assert(sample.sourceCharacters <= sampleCharacterLimit, 'Visual sample is too large');

  await page.bringToFront();
  const tabId = await worker.evaluate(async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return activeTab?.id;
  });
  assert.equal(typeof tabId, 'number');

  const startedAt = performance.now();
  const startResult = await optionsPage.evaluate(async (activeTabId) => {
    await chrome.tabs.update(activeTabId, { active: true });
    await new Promise((resolve) => setTimeout(resolve, 150));
    return chrome.runtime.sendMessage({
      type: 'TRANSLATE_ACTIVE_TAB',
      targetLanguage: 'zh-CN',
    });
  }, tabId);
  assert.deepEqual(startResult, { ok: true, message: '已开始翻译当前网页' });

  await page.waitForFunction(() => {
    return document.querySelectorAll('.textduet-translation').length > 0;
  }, undefined, { timeout: 600_000 });

  const result = await page.evaluate(() => {
    const translations = Array.from(document.querySelectorAll('.textduet-translation'));
    const excluded = 'code, pre, textarea, input, select, button, form, nav, footer, menu, [contenteditable]:not([contenteditable="false"]), [aria-hidden="true"], [hidden], [inert], [role="button"], [role="navigation"], [role="menu"]';
    return {
      state: translations.length > 0 ? 'complete' : 'empty',
      statusMessage: '',
      translatedCount: translations.length,
      pureTextCount: translations.filter((translation) =>
        translation.childNodes.length === 1
        && translation.firstChild?.nodeType === Node.TEXT_NODE,
      ).length,
      excludedTranslationCount: Array.from(document.querySelectorAll(excluded)).reduce(
        (count, element) => count + element.querySelectorAll('.textduet-translation').length,
        0,
      ),
    };
  });
  if (result.state !== 'complete') {
    process.stderr.write(`${JSON.stringify({
      targetUrl,
      state: result.state,
      category: classifyTranslationFailure(result.statusMessage),
      providerRequests,
    }, null, 2)}\n`);
    throw new Error(`TextDuet translation failed: ${classifyTranslationFailure(result.statusMessage)}`);
  }
  assert(
    result.translatedCount >= sample.selectedCount,
    'TextDuet rendered fewer translations than the visual sample requires',
  );
  assert.equal(result.pureTextCount, result.translatedCount, 'A translation was not plain text');
  assert.equal(result.excludedTranslationCount, 0, 'Excluded page content was translated');

  const firstTranslation = page.locator('.textduet-translation').first();
  await firstTranslation.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -160));
  await page.waitForTimeout(800);
  await page.screenshot({
    path: viewportScreenshot,
    animations: 'disabled',
  });
  await page.screenshot({
    path: fullPageScreenshot,
    fullPage: true,
    animations: 'disabled',
  });
  const usageResult = await captureUsageResult(optionsPage, usageScreenshot);
  assert(usageResult.recordCount > 0, 'The real Provider call was not recorded');
  assert(usageResult.actualCalls > 0, 'The ledger did not record actual usage');
  assert.equal(usageResult.estimatedCalls, 0, 'Estimated usage entered the actual-only ledger');
  assert.equal(
    usageResult.inputTokens + usageResult.outputTokens,
    usageResult.totalTokens,
    'Displayed token total does not match input plus output',
  );

  process.stdout.write(`${JSON.stringify({
    targetUrl,
    httpStatus: response.status(),
    durationMs: Math.round(performance.now() - startedAt),
    translatedCount: result.translatedCount,
    pureTextCount: result.pureTextCount,
    excludedTranslationCount: result.excludedTranslationCount,
    controlledSample: sample,
    providerRequests,
    usage: usageResult,
    screenshots: { viewportScreenshot, fullPageScreenshot, usageScreenshot },
  }, null, 2)}\n`);
} finally {
  try {
    await context?.close();
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function captureUsageResult(optionsPage, screenshotPath) {
  await optionsPage.reload();
  const usageHeading = optionsPage.getByRole('heading', { name: 'Token 用量' });
  await usageHeading.waitFor();
  const usageCard = optionsPage.locator('.settings-card').filter({ has: usageHeading });
  await optionsPage.waitForFunction(() => {
    const totals = Array.from(document.querySelectorAll('.usage-total-grid strong'))
      .map((element) => Number((element.textContent || '').replaceAll(',', '')));
    return totals.length === 3 && totals[2] > 0;
  }, undefined, { timeout: 15_000 });

  const displayedTotals = await usageCard.locator('.usage-total-grid strong').allTextContents();
  const [inputTokens, outputTokens, totalTokens] = displayedTotals.map((value) =>
    Number(value.replaceAll(',', '')),
  );
  const ledger = await optionsPage.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('textduet-usage', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const records = await new Promise((resolve, reject) => {
      const request = database.transaction('dailyUsage', 'readonly')
        .objectStore('dailyUsage').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return records.reduce((summary, record) => ({
      recordCount: summary.recordCount + 1,
      actualCalls: summary.actualCalls + Number(record.actualCalls || 0),
      estimatedCalls: summary.estimatedCalls + Number(record.estimatedCalls || 0),
    }), { recordCount: 0, actualCalls: 0, estimatedCalls: 0 });
  });
  const chartPixels = await usageCard.locator('.usage-chart canvas').evaluate((canvas) => {
    const context = canvas.getContext('2d');
    if (!context) return 0;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let visiblePixels = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) visiblePixels += 1;
    }
    return visiblePixels;
  });
  assert(chartPixels > 1_000, 'Usage chart canvas is blank');
  await usageCard.screenshot({ path: screenshotPath, animations: 'disabled' });

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    recordCount: ledger.recordCount,
    actualCalls: ledger.actualCalls,
    estimatedCalls: ledger.estimatedCalls,
    chartPixels,
  };
}

function readProviderEnvironment() {
  const required = [
    'TEXTDUET_TEST_API_HOST',
    'TEXTDUET_TEST_API_BASE_URL',
    'TEXTDUET_TEST_API_KEY',
    'TEXTDUET_TEST_MODEL',
  ];
  for (const key of required) {
    assert(process.env[key]?.trim(), `Missing required environment variable: ${key}`);
  }

  const baseUrl = new URL(process.env.TEXTDUET_TEST_API_BASE_URL.trim().replace(/\/$/, ''));
  const hostValue = process.env.TEXTDUET_TEST_API_HOST.trim();
  const host = new URL(/^https?:\/\//i.test(hostValue) ? hostValue : `https://${hostValue}`);
  assert.equal(baseUrl.protocol, 'https:', 'Provider base URL must use HTTPS');
  assert.equal(baseUrl.origin, host.origin, 'Provider host does not match base URL');
  return {
    baseUrl: baseUrl.href.replace(/\/$/, ''),
    apiKey: process.env.TEXTDUET_TEST_API_KEY.trim(),
    model: process.env.TEXTDUET_TEST_MODEL.trim(),
  };
}

async function prepareTestExtension(targetDir, hostPermissions) {
  await cp(builtExtensionDir, targetDir, { recursive: true });
  const manifestPath = resolve(targetDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.host_permissions = [
    ...new Set([...(manifest.host_permissions || []), ...hostPermissions]),
  ];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function saveProviderSettings(page, settings) {
  const result = await page.evaluate(async ({ baseUrl, apiKey, model }) => {
    return chrome.runtime.sendMessage({
      type: 'SAVE_PROVIDER_SETTINGS',
      settings: {
        provider: 'openai-compatible',
        baseUrl,
        model,
        apiKeyPersistence: 'session',
        targetLanguage: 'zh-CN',
        displayMode: 'bilingual',
        customSystemPrompt: '',
      },
      apiKey,
    });
  }, settings);
  assert(result?.ok, 'Provider settings could not be saved');
}

function trackProviderRequests(browserContext, providerOrigin, requests) {
  const pending = new Map();
  browserContext.on('request', (request) => {
    if (!isProviderRequest(request.url(), providerOrigin)) return;
    const record = { status: null, outcome: 'pending', blockCount: null, sourceCharacters: null };
    try {
      const payload = request.postDataJSON();
      const userContent = payload?.messages?.find((message) => message?.role === 'user')?.content;
      const translationRequest = typeof userContent === 'string' ? JSON.parse(userContent) : null;
      if (Array.isArray(translationRequest?.blocks)) {
        record.blockCount = translationRequest.blocks.length;
        record.sourceCharacters = translationRequest.blocks.reduce(
          (sum, block) => sum + (typeof block?.text === 'string' ? block.text.length : 0),
          0,
        );
      }
    } catch {
      // Only aggregate counts are retained in the report.
    }
    requests.push(record);
    pending.set(request, record);
  });
  browserContext.on('response', (response) => {
    const record = pending.get(response.request());
    if (!record) return;
    record.status = response.status();
    record.outcome = 'response';
    pending.delete(response.request());
  });
  browserContext.on('requestfailed', (request) => {
    const record = pending.get(request);
    if (!record) return;
    record.outcome = 'network-failure';
    pending.delete(request);
  });
}

async function prepareVisualSample(page, blockLimit, characterLimit) {
  return page.evaluate(({ blockLimit, characterLimit }) => {
    const selector = 'h1, h2, h3, h4, h5, h6, p, li, blockquote, td, figcaption';
    const excluded = 'script, style, noscript, code, pre, textarea, input, select, button, form, nav, footer, menu, [contenteditable]:not([contenteditable="false"]), [aria-hidden="true"], [hidden], [inert], [role="button"], [role="navigation"], [role="menu"]';
    const root = document.querySelector('main article, article, main') || document.body;
    const normalize = (value) => value.replace(/\s+/g, ' ').trim();
    const isVisible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.opacity !== '0'
        && rect.width > 0
        && rect.height > 0;
    };
    const candidates = Array.from(root.querySelectorAll(selector)).filter((element) => {
      const text = normalize(element.innerText || '');
      return !element.closest(excluded)
        && isVisible(element)
        && text.length >= 20
        && text.length <= 900;
    });
    const candidateSet = new Set(candidates);
    const leaves = candidates.filter((element) =>
      !Array.from(element.querySelectorAll(selector)).some((child) => candidateSet.has(child)),
    );
    const selected = [];
    let sourceCharacters = 0;
    const add = (element) => {
      if (!element || selected.includes(element) || selected.length >= blockLimit) return;
      const text = normalize(element.innerText || '');
      if (sourceCharacters + text.length > characterLimit) return;
      selected.push(element);
      sourceCharacters += text.length;
    };

    add(leaves.find((element) => element.tagName === 'H1'));
    for (const element of leaves.filter((candidate) => candidate.tagName === 'P')) add(element);
    for (const element of leaves) add(element);
    if (selected.length < blockLimit) throw new Error('Not enough representative article blocks');

    selected.forEach((element, index) => {
      element.dataset.textduetVisualSelected = String(index + 1);
    });
    for (const element of candidates) {
      if (!selected.includes(element) && !selected.some((chosen) => element.contains(chosen))) {
        element.setAttribute('aria-hidden', 'true');
      }
    }

    return {
      selectedCount: selected.length,
      sourceCharacters,
      headingCount: selected.filter((element) => /^H[1-6]$/.test(element.tagName)).length,
      paragraphCount: selected.filter((element) => element.tagName === 'P').length,
    };
  }, { blockLimit, characterLimit });
}

function isProviderRequest(rawUrl, providerOrigin) {
  try {
    const url = new URL(rawUrl);
    return url.origin === providerOrigin && /\/chat\/completions\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

function classifyTranslationFailure(message) {
  const value = String(message || '').toLowerCase();
  if (/认证|api key|401|403/.test(value)) return 'authentication';
  if (/余额|402/.test(value)) return 'balance';
  if (/接口|模型名称|404/.test(value)) return 'endpoint-or-model';
  if (/限流|429/.test(value)) return 'rate-limit';
  if (/格式|json|段落数量/.test(value)) return 'response-format';
  if (/超时|timeout/.test(value)) return 'timeout';
  if (/不可用|network|fetch|连接/.test(value)) return 'network-or-provider';
  return 'unknown';
}
