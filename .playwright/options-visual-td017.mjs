import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';

const playwrightModule = await import(process.env.PLAYWRIGHT_ENTRY);
const { chromium } = playwrightModule.default ?? playwrightModule;
const extensionDir = resolve(process.env.EXTENSION_DIR);
const chromeExecutable = process.env.CHROME_EXECUTABLE;
assert(extensionDir && chromeExecutable);

await mkdir(resolve('.playwright/browser-profile'), { recursive: true });
await mkdir(resolve('output/playwright'), { recursive: true });
const profileDir = await mkdtemp(resolve('.playwright/browser-profile/options-td017-'));
const server = await startStaticServer(extensionDir);
let context;

try {
  context = await chromium.launchPersistentContext(profileDir, {
    executablePath: chromeExecutable,
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
  });
  const page = await context.newPage();
  await page.addInitScript(({ settings, history }) => {
    const responses = {
      GET_PROVIDER_SETTINGS: { ...settings, hasApiKey: true },
      GET_USAGE_HISTORY: history,
      REFRESH_PROVIDER_PRICING: { status: 'unavailable' },
      GET_TRANSLATION_CACHE_DASHBOARD: {
        entryCount: 18,
        sizeBytes: 24_000,
        maxSizeBytes: 52_428_800,
        ttlDays: 30,
        isAvailable: true,
      },
      GET_COST_DASHBOARD: {
        settings: {
          version: 1,
          price: {
            enabled: false,
            model: '',
            currency: 'USD',
            inputPerMillion: 0,
            outputPerMillion: 0,
            updatedAt: '2026-08-18',
            source: 'user',
          },
          budget: { enabled: false, dailyLimit: 0 },
        },
        today: {
          date: '2026-08-18',
          currency: 'USD',
          inputTokens: 1_560,
          outputTokens: 800,
          actualCost: 0,
          estimatedCost: 0,
          totalCost: 0,
          hasActualUsage: true,
          hasEstimatedUsage: false,
          budgetEnabled: false,
          dailyBudget: 0,
          budgetPercentage: 0,
          notifiedThresholds: [],
        },
        isPriceForCurrentModel: false,
        isLedgerAvailable: true,
      },
    };
    globalThis.browser = {
      runtime: {
        id: 'textduet-visual-test',
        sendMessage: async (message) => {
      const response = responses[message?.type];
          if (response !== undefined) return response;
          return { ok: false, message: `visual mock missing: ${message?.type}` };
        },
      },
      permissions: { request: async () => true },
    };
  }, createVisualState());

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(server.url);
  await page.getByRole('heading', { name: '连接你的翻译模型' }).waitFor();
  await page.getByRole('button', { name: /qwen-plus.*当前/ }).waitFor();
  await page.locator('.usage-chart canvas').waitFor();

  const modelInput = page.getByLabel('添加模型名称或 code');
  await modelInput.fill('qwen-turbo');
  await modelInput.press('Enter');
  assert.equal(await page.getByRole('button', { name: '删除模型 qwen-turbo' }).count(), 1);
  await page.getByRole('button', { name: '删除模型 qwen-turbo' }).click();
  assert.equal(await page.getByRole('button', { name: '删除模型 qwen-turbo' }).count(), 0);

  const modelFilters = page.locator('.model-filter');
  assert.equal(await modelFilters.count(), 2);
  await modelFilters.filter({ hasText: 'qwen-plus-fast' }).click();
  assert.equal(
    await modelFilters.filter({ hasText: 'qwen-plus-fast' }).getAttribute('aria-pressed'),
    'true',
  );
  const canvasPixels = await page.locator('.usage-chart canvas').evaluate((canvas) => {
    const context = canvas.getContext('2d');
    const pixels = context?.getImageData(0, 0, canvas.width, canvas.height).data || [];
    let visible = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) visible += 1;
    }
    return visible;
  });
  assert(canvasPixels > 100, 'usage chart is blank');
  assert.equal(await hasHorizontalOverflow(page), false);
  await page.screenshot({
    path: resolve('output/playwright', 'td017-options-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await hasHorizontalOverflow(page), false);
  await page.screenshot({
    path: resolve('output/playwright', 'td017-options-narrow.png'),
    fullPage: true,
    animations: 'disabled',
  });

  console.log(JSON.stringify({ mode: 'production-assets-with-local-runtime-mock', canvasPixels, modelCount: 2, overflow: false }));
} finally {
  await context?.close();
  await server.close();
  await rm(profileDir, { recursive: true, force: true });
}

function createVisualState() {
  const dates = Array.from({ length: 60 }, (_, index) => {
    const date = new Date(2026, 6, 20 + index, 12);
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  });
  const createPoints = (inputStep, outputStep) => dates.map((date, index) => ({
    date,
    inputTokens: index < 52 ? 0 : (index - 51) * inputStep,
    outputTokens: index < 52 ? 0 : (index - 51) * outputStep,
    hasEstimatedUsage: false,
  }));
  const primaryPoints = createPoints(155, 82);
  const fastPoints = createPoints(42, 18);
  const modelSeries = (model, points) => ({
    provider: 'openai-compatible',
    model,
    points,
    totalInputTokens: points.reduce((sum, point) => sum + point.inputTokens, 0),
    totalOutputTokens: points.reduce((sum, point) => sum + point.outputTokens, 0),
    hasEstimatedUsage: false,
  });
  const models = [
    modelSeries('qwen-plus', primaryPoints),
    modelSeries('qwen-plus-fast', fastPoints),
  ];
  return {
    settings: {
      provider: 'openai-compatible',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-plus',
      models: ['qwen-plus', 'qwen-plus-fast'],
      apiKeyPersistence: 'session',
      targetLanguage: 'zh-CN',
      displayMode: 'bilingual',
      translationColor: '#b91c1c',
      customSystemPrompt: '',
    },
    history: {
      days: 60,
      points: dates.map((date, index) => ({
        date,
        inputTokens: primaryPoints[index].inputTokens + fastPoints[index].inputTokens,
        outputTokens: primaryPoints[index].outputTokens + fastPoints[index].outputTokens,
        hasEstimatedUsage: false,
      })),
      totalInputTokens: models.reduce((sum, model) => sum + model.totalInputTokens, 0),
      totalOutputTokens: models.reduce((sum, model) => sum + model.totalOutputTokens, 0),
      hasEstimatedUsage: false,
      models,
      isLedgerAvailable: true,
      source: 'local',
    },
  };
}

async function hasHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}

async function startStaticServer(rootDir) {
  const mimeTypes = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.svg', 'image/svg+xml'],
    ['.png', 'image/png'],
  ]);
  const httpServer = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
      const relativePath = pathname === '/' ? 'options.html' : pathname.replace(/^\/+/, '');
      const filePath = resolve(rootDir, relativePath);
      if (!filePath.startsWith(`${rootDir}/`) && filePath !== rootDir) {
        response.writeHead(403).end();
        return;
      }
      const body = await readFile(filePath);
      response.writeHead(200, { 'Content-Type': mimeTypes.get(extname(filePath)) || 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolveListen, rejectListen) => {
    httpServer.once('error', rejectListen);
    httpServer.listen(0, '127.0.0.1', resolveListen);
  });
  const address = httpServer.address();
  assert(address && typeof address === 'object');
  return {
    url: `http://127.0.0.1:${address.port}/options.html`,
    close: () => new Promise((resolveClose, rejectClose) => {
      httpServer.close((error) => error ? rejectClose(error) : resolveClose());
    }),
  };
}
