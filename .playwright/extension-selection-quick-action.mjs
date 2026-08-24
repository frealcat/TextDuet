import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const playwrightEntry = process.env.PLAYWRIGHT_ENTRY;
const chromeExecutable = process.env.CHROME_EXECUTABLE;
const extensionSource = resolve(process.env.EXTENSION_DIR || '.output/chrome-mv3');
const targetUrl = 'https://stackoverflow.blog/2026/03/02/what-s-new-at-stack-overflow-march-2026/';

assert(playwrightEntry, 'PLAYWRIGHT_ENTRY is required');
assert(chromeExecutable, 'CHROME_EXECUTABLE is required');

const playwrightModule = await import(playwrightEntry);
const { chromium } = playwrightModule.default || playwrightModule;
const tempRoot = await mkdtemp(resolve('.playwright/browser-profile/selection-quick-action-'));
const extensionDir = resolve(tempRoot, 'extension');
const profileDir = resolve(tempRoot, 'profile');
const screenshotPath = resolve('.playwright/selection-quick-action-stackoverflow-blog.png');
let context;

try {
  await cp(extensionSource, extensionDir, { recursive: true });
  await addTestHostPermission(extensionDir, new URL(targetUrl).origin);

  context = await chromium.launchPersistentContext(profileDir, {
    executablePath: chromeExecutable,
    headless: false,
    // Playwright disables extensions by default; retain the explicit local extension flags below.
    ignoreDefaultArgs: ['--disable-extensions'],
    viewport: { width: 1440, height: 960 },
    args: [
      '--enable-extensions',
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
    ],
  });

  const worker = await getServiceWorker(context);
  const extensionId = new URL(worker.url()).hostname;
  const extensionOrigin = `chrome-extension://${extensionId}`;
  const optionsPage = await context.newPage();
  await optionsPage.goto(`${extensionOrigin}/options.html`);
  await optionsPage.getByRole('heading', { name: '连接你的翻译模型' }).waitFor();

  const page = await context.newPage();
  const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert(response?.ok(), `Target returned HTTP ${response?.status()}`);
  const paragraph = page.locator('article p').filter({ hasText: 'Welcome to the March recap' }).first();
  await paragraph.waitFor({ state: 'visible', timeout: 30_000 });
  await page.bringToFront();

  const tabId = await worker.evaluate(async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return activeTab?.id;
  });
  assert.equal(typeof tabId, 'number', 'Could not resolve the article tab');

  await optionsPage.evaluate(async (articleTabId) => {
    await chrome.tabs.update(articleTabId, { active: true });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const saved = await chrome.runtime.sendMessage({
      type: 'SET_SELECTION_QUICK_ACTION',
      enabled: true,
    });
    if (!saved?.ok) throw new Error(saved?.message || 'Could not enable quick action');
    const configured = await chrome.runtime.sendMessage({
      type: 'CONFIGURE_SELECTION_QUICK_ACTION',
      enabled: true,
      sourceLanguage: 'auto',
      targetLanguage: 'zh-CN',
      translationColor: '#9c5e2e',
    });
    if (!configured?.ok) throw new Error(configured?.message || 'Could not configure quick action');
  }, tabId);

  await page.waitForFunction(() => Boolean(document.getElementById('textduet-styles')), undefined, { timeout: 10_000 });
  await paragraph.evaluate((element) => {
    const textNode = element.firstChild;
    if (!textNode) throw new Error('Paragraph has no text node');
    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, Math.min(textNode.textContent?.length || 0, 58));
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });

  const quickAction = page.locator('.textduet-selection-quick-action');
  await quickAction.waitFor({ state: 'visible', timeout: 5_000 });
  const details = await quickAction.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      label: element.getAttribute('aria-label'),
      text: element.textContent,
      visible: rect.width > 0 && rect.height > 0,
      position: getComputedStyle(element).position,
    };
  });
  assert.deepEqual(details, {
    label: '翻译选中文本',
    text: '文A',
    visible: true,
    position: 'fixed',
  });

  await page.screenshot({ path: screenshotPath, animations: 'disabled' });
  process.stdout.write(`${JSON.stringify({ targetUrl, details, screenshotPath }, null, 2)}\n`);
} finally {
  try {
    await context?.close();
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function addTestHostPermission(directory, origin) {
  const manifestPath = resolve(directory, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.host_permissions = [...new Set([...(manifest.host_permissions || []), `${origin}/*`])];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function getServiceWorker(browserContext) {
  const existing = browserContext.serviceWorkers()[0];
  return existing || browserContext.waitForEvent('serviceworker', { timeout: 15_000 });
}
