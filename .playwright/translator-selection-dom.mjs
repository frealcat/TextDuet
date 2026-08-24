import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const playwrightEntry = process.env.PLAYWRIGHT_ENTRY;
const chromeExecutable = process.env.CHROME_EXECUTABLE;
const targetUrl = 'https://stackoverflow.blog/2026/03/02/what-s-new-at-stack-overflow-march-2026/';
const translatorPath = resolve('.output/chrome-mv3/translator.js');
const screenshotPath = resolve('.playwright/selection-quick-action-stackoverflow-blog.png');

assert(playwrightEntry, 'PLAYWRIGHT_ENTRY is required');
assert(chromeExecutable, 'CHROME_EXECUTABLE is required');

const playwrightModule = await import(playwrightEntry);
const { chromium } = playwrightModule.default || playwrightModule;
const browser = await chromium.launch({ executablePath: chromeExecutable, headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  assert(response?.ok(), 'Target returned HTTP ' + response?.status());
  const paragraph = page.locator('article p').filter({ hasText: 'Welcome to the March recap' }).first();
  await paragraph.waitFor({ state: 'visible', timeout: 30_000 });
  await paragraph.scrollIntoViewIfNeeded();
  await page.waitForFunction((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  }, await paragraph.elementHandle(), { timeout: 5_000 });

  await page.evaluate(() => {
    const listeners = [];
    globalThis.chrome = {
      runtime: {
        id: 'textduet-dom-self-test',
        onMessage: { addListener(listener) { listeners.push(listener); } },
        sendMessage: async () => ({ ok: true }),
      },
      __textduetListeners: listeners,
    };
  });
  await page.addScriptTag({ path: translatorPath });
  const configured = await page.evaluate(async () => {
    const listener = globalThis.chrome.__textduetListeners.at(-1);
    if (!listener) throw new Error('Translator did not register its runtime listener');
    return await new Promise((resolve) => listener({
      type: 'CONFIGURE_SELECTION_QUICK_ACTION',
      enabled: true,
      sourceLanguage: 'auto',
      targetLanguage: 'zh-CN',
      translationColor: '#9c5e2e',
    }, {}, resolve));
  });
  assert.equal(configured?.ok, true, 'Translator did not enable the selection quick action');

  await paragraph.evaluate((element) => {
    const textNode = element.firstChild;
    if (!textNode) throw new Error('The test paragraph has no text node');
    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, Math.min(textNode.textContent?.length || 0, 230));
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
    const selection = window.getSelection();
    const selectionRects = selection?.rangeCount
      ? [...selection.getRangeAt(0).getClientRects()].map((selectionRect) => ({
        left: selectionRect.left, right: selectionRect.right, top: selectionRect.top, bottom: selectionRect.bottom,
      }))
      : [];
    return {
      label: element.getAttribute('aria-label'),
      text: element.textContent,
      visible: rect.width > 0 && rect.height > 0,
      position: getComputedStyle(element).position,
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom),
      selectionRects,
      scrollY: Math.round(window.scrollY),
      innerHeight: window.innerHeight,
      htmlTransform: getComputedStyle(document.documentElement).transform,
      bodyTransform: getComputedStyle(document.body).transform,
    };
  });
  assert.equal(details.label, '翻译选中文本');
  assert.equal(details.text, '文A');
  assert.equal(details.visible, true);
  assert.equal(details.position, 'fixed');
  assert(details.top >= 0 && details.top < 960, 'Quick action must be inside the viewport');
  assert(details.left >= 0 && details.left < 1440, 'Quick action must be inside the viewport');
  const overlapsSelection = details.selectionRects.some((selectionRect) =>
    details.left < selectionRect.right
      && details.right > selectionRect.left
      && details.top < selectionRect.bottom
      && details.bottom > selectionRect.top,
  );
  assert.equal(overlapsSelection, false, 'Quick action must stay outside every selected line');
  await page.screenshot({ path: screenshotPath, animations: 'disabled' });
  process.stdout.write(JSON.stringify({ targetUrl, details, screenshotPath }, null, 2) + '\\n');
} finally {
  await browser.close();
}
