import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const playwrightEntry = process.env.PLAYWRIGHT_ENTRY;
const chromeExecutable = process.env.CHROME_EXECUTABLE;
const extensionDir = resolve(process.env.EXTENSION_DIR || '.output/chrome-mv3');
const outputDir = resolve(process.env.TEXTDUET_BILLING_OUTPUT_DIR || 'output/playwright');

assert(playwrightEntry, 'PLAYWRIGHT_ENTRY is required');
assert(chromeExecutable, 'CHROME_EXECUTABLE is required');

const { chromium } = await import(playwrightEntry);
const tempRoot = await mkdtemp(resolve('.playwright/browser-profile/billing-'));
const desktopScreenshot = resolve(outputDir, 'usage-balance-desktop.png');
const narrowScreenshot = resolve(outputDir, 'usage-balance-narrow.png');
let context;

try {
  await mkdir(outputDir, { recursive: true });
  context = await chromium.launchPersistentContext(resolve(tempRoot, 'profile'), {
    executablePath: chromeExecutable,
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
    locale: 'zh-CN',
    viewport: { width: 1280, height: 900 },
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
    ],
  });

  const worker = context.serviceWorkers()[0]
    || await context.waitForEvent('serviceworker', { timeout: 15_000 });
  const extensionOrigin = `chrome-extension://${new URL(worker.url()).hostname}`;
  const page = await context.newPage();
  await page.goto(`${extensionOrigin}/options.html`);
  await page.getByRole('heading', { name: '连接你的翻译模型' }).waitFor();
  await saveDeepSeekSettings(page);
  await seedUsageLedger(page);
  await page.reload();

  await page.getByRole('heading', { name: 'Token 用量' }).waitFor();
  await page.getByText('最近 60 天', { exact: true }).waitFor();
  const totals = await page.locator('.usage-total-grid strong').allTextContents();
  assert.deepEqual(totals, ['1,340', '700', '2,040']);
  assert.equal(await countUsageRecords(page), 2, 'Retention cleanup did not remove stale data');

  const chartPixels = await page.locator('.usage-chart canvas').evaluate((canvas) => {
    const context2d = canvas.getContext('2d');
    if (!context2d) return 0;
    const pixels = context2d.getImageData(0, 0, canvas.width, canvas.height).data;
    let visiblePixels = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) visiblePixels += 1;
    }
    return visiblePixels;
  });
  assert(chartPixels > 1_000, 'Token chart canvas is unexpectedly blank');

  await installBalanceMock(worker);
  const balanceButton = page.getByRole('button', { name: '查询余额' });
  await balanceButton.focus();
  assert.equal(await balanceButton.evaluate((button) => document.activeElement === button), true);
  await balanceButton.click();
  await page.getByText('DeepSeek 余额已更新').waitFor();
  await page.getByText('CNY 12.50', { exact: true }).waitFor();
  await page.getByText('充值 10.00 · 赠送 2.50', { exact: true }).waitFor();
  assert.equal(await page.getByText('余额可用', { exact: true }).count(), 1);
  assert.equal(await page.locator('body').getByText('billing-browser-placeholder').count(), 0);
  assert.deepEqual(await readBalanceMockAudit(worker), {
    url: 'https://api.deepseek.com/user/balance',
    authorizationMatched: true,
  });

  await page.screenshot({ path: desktopScreenshot, fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: narrowScreenshot, fullPage: true, animations: 'disabled' });
  const overflow = await page.locator('.provider-balance, .balance-list > div, .usage-total-grid')
    .evaluateAll((elements) => elements.filter((element) =>
      element.scrollWidth > element.clientWidth + 1,
    ).length);
  assert.equal(overflow, 0, 'Billing UI overflows at 390px');

  process.stdout.write(`${JSON.stringify({
    extensionId: new URL(worker.url()).hostname,
    historyDays: 60,
    retainedRecords: 2,
    totals,
    chartPixels,
    balanceCurrencies: ['CNY'],
    desktopScreenshot,
    narrowScreenshot,
  }, null, 2)}\n`);
} finally {
  await context?.close();
  await rm(tempRoot, { recursive: true, force: true });
}

async function saveDeepSeekSettings(page) {
  const result = await page.evaluate(async () => chrome.runtime.sendMessage({
    type: 'SAVE_PROVIDER_SETTINGS',
    settings: {
      provider: 'openai-compatible',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      apiKeyPersistence: 'session',
      targetLanguage: 'zh-CN',
      displayMode: 'bilingual',
      customSystemPrompt: '',
    },
    apiKey: 'billing-browser-placeholder',
  }));
  assert(result?.ok, result?.message || 'DeepSeek settings could not be saved');
}

async function seedUsageLedger(page) {
  await page.evaluate(async () => {
    const formatDate = (date) => [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
    const dateAtOffset = (offset) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() + offset);
      return formatDate(date);
    };
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('textduet-usage', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('dailyUsage', 'readwrite');
    const store = transaction.objectStore('dailyUsage');
    const records = [
      { date: dateAtOffset(0), inputTokens: 1_240, outputTokens: 680, estimatedCalls: 0 },
      { date: dateAtOffset(-59), inputTokens: 100, outputTokens: 20, estimatedCalls: 0 },
      { date: dateAtOffset(-60), inputTokens: 9_999, outputTokens: 9_999, estimatedCalls: 0 },
      { date: dateAtOffset(-1), inputTokens: 8_888, outputTokens: 8_888, estimatedCalls: 1 },
    ];
    for (const record of records) {
      const dateCurrency = `${record.date}:USD`;
      store.put({
        key: `${dateCurrency}:openai-compatible:seed-model-${record.date}`,
        date: record.date,
        dateCurrency,
        provider: 'openai-compatible',
        model: `seed-model-${record.date}`,
        currency: 'USD',
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        actualCost: 0,
        estimatedCost: record.estimatedCalls > 0 ? 0.01 : 0,
        actualCalls: record.estimatedCalls > 0 ? 0 : 1,
        estimatedCalls: record.estimatedCalls,
      });
    }
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  });
}

async function countUsageRecords(page) {
  return page.evaluate(async () => {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('textduet-usage', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise((resolve, reject) => {
      const request = database.transaction('dailyUsage', 'readonly')
        .objectStore('dailyUsage').count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

async function installBalanceMock(worker) {
  await worker.evaluate(() => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      if (url !== 'https://api.deepseek.com/user/balance') {
        return originalFetch(input, init);
      }
      const authorization = new Headers(init?.headers).get('Authorization');
      globalThis.__textduetBalanceAudit = {
        url,
        authorizationMatched: authorization === 'Bearer billing-browser-placeholder',
      };
      return new Response(JSON.stringify({
        is_available: true,
        balance_infos: [{
          currency: 'CNY',
          total_balance: '12.50',
          granted_balance: '2.50',
          topped_up_balance: '10.00',
        }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  });
}

async function readBalanceMockAudit(worker) {
  return worker.evaluate(() => globalThis.__textduetBalanceAudit || null);
}
