import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { resolve } from 'node:path';

const playwrightModule = await import(process.env.PLAYWRIGHT_ENTRY);
const { chromium } = playwrightModule.default ?? playwrightModule;
const builtExtensionDir = process.env.EXTENSION_DIR;
const chromeExecutable = process.env.CHROME_EXECUTABLE;
const fixtureBaseUrl = process.env.FIXTURE_BASE_URL || 'http://127.0.0.1:8765/';
const smokeApiKey = process.env.TEXTDUET_SMOKE_API_KEY || 'test-only-placeholder';
const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
const fixtureHostPermission = new URL('*', fixtureBaseUrl).href;
const fixtures = [
  'article-basic.html',
  'technical-docs.html',
  'discussion-dynamic.html',
  'dynamic-virtualized.html',
  'mixed-ui.html',
  'multilingual.html',
].map((name) => ({ name, url: new URL(name, fixtureBaseUrl).href }));
fixtures.push({
  name: 'chroma-research-toc.html',
  url: 'https://www.trychroma.com/research/textduet-context-fixture',
});
const chromaFixtureBody = await readFile(
  resolve('tests/fixtures/pages/chroma-research-toc.html'),
  'utf8',
);
const unsafeModelText =
  '<img src=x onerror="globalThis.__textDuetExecuted=true"><script>globalThis.__textDuetExecuted=true</script>';

assert(builtExtensionDir && chromeExecutable);
await mkdir(resolve('.playwright/browser-profile'), { recursive: true });
const harnessDir = await mkdtemp(resolve('.playwright/browser-profile/corpus-'));
const extensionDir = resolve(harnessDir, 'extension');
const profileDir = process.env.CHROME_PROFILE || resolve(harnessDir, 'profile');

let context;

try {
  await prepareTestExtension(builtExtensionDir, extensionDir, fixtureHostPermission);
  context = await chromium.launchPersistentContext(profileDir, {
    executablePath: chromeExecutable,
    headless,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });
  const worker = await getServiceWorker(context);
  const extensionId = new URL(worker.url()).hostname;
  const extensionOrigin = `chrome-extension://${extensionId}`;
  const browserVersion = context.browser()?.version() || 'unknown';
  const providerRequests = [];
  let providerMode = 'normal';
  let providerRequestSequence = 0;
  context.on('request', (request) => {
    if (request.url().startsWith('https://api.example.com/')) {
      providerRequests.push(request.url());
    }
  });
  await context.route('https://api.example.com/**', async (route) => {
    const requestBody = route.request().postDataJSON();
    const userMessage = requestBody.messages.find((message) => message.role === 'user');
    const translationRequest = JSON.parse(userMessage.content);
    const sequence = ++providerRequestSequence;
    const blocks = translationRequest.blocks.map((block, index) => ({
      id: block.id,
      translatedText: providerMode === 'untrusted-output' && index === 0
        ? unsafeModelText
        : `【Mock:${requestBody.model}:${sequence}】${block.text}`,
      ...(block.styleContext ? { colorPreference: 'preferred' } : {}),
    }));
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 80));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        model: requestBody.model,
        usage: {
          prompt_tokens: Math.max(1, blocks.length * 10),
          completion_tokens: Math.max(1, blocks.length * 8),
        },
        choices: [{ message: { content: JSON.stringify({ blocks }) } }],
      }),
    });
  });
  await context.route(
    'https://www.trychroma.com/research/textduet-context-fixture',
    (route) => route.fulfill({ status: 200, contentType: 'text/html', body: chromaFixtureBody }),
  );

  const optionsPage = await context.newPage();
  await optionsPage.goto(`${extensionOrigin}/options.html`);
  await optionsPage.getByRole('heading', { name: '连接你的翻译模型' }).waitFor();
  await verifyQwenPreset(optionsPage);
  await saveTestSettings(optionsPage, smokeApiKey);
  await seedUsageLedger(optionsPage);
  await optionsPage.reload();
  await verifySavedM2Settings(optionsPage);
  await verifyUsageDashboard(optionsPage);

  const popupPage = await context.newPage();
  await popupPage.goto(`${extensionOrigin}/popup.html`);
  await popupPage.getByRole('button', { name: '翻译当前网页' }).waitFor();
  await verifyPopupUsage(popupPage);
  await verifyPopupModelControls(popupPage);

  const fixtureResults = [];
  for (const fixture of fixtures) {
    const fixturePage = await context.newPage();
    await fixturePage.goto(fixture.url);
    await installCompletionTracker(fixturePage);
    const protectedBefore = await snapshotExcludedContent(fixturePage);

    const firstDurationMs = fixture.name === 'article-basic.html'
      ? await runFromPopupAndWaitForCompletion(popupPage, fixturePage)
      : await runAndWaitForCompletion(worker, popupPage, fixturePage);
    const firstAssessment = await assessFixture(fixturePage);
    assertFixtureAssessment(fixture.name, firstAssessment);
    assert.deepEqual(await snapshotExcludedContent(fixturePage), protectedBefore);
    if (fixture.name === 'article-basic.html') {
      await verifyReadingControls(popupPage, fixturePage);
      await verifyCompatibilityDiagnostic(optionsPage, firstAssessment.translatedCount);
      await fixturePage.bringToFront();
      await popupPage.reload();
      const firstTranslations = await getTranslationTexts(fixturePage);
      await popupPage.getByLabel('使用模型').selectOption('textduet-smoke-model-fast');
      assert.deepEqual(await getTranslationTexts(fixturePage), firstTranslations);
    }

    const requestCountBeforeRepeat = providerRequests.length;
    const secondDurationMs = fixture.name === 'article-basic.html'
      ? await runFromPopupAndWaitForCompletion(popupPage, fixturePage)
      : await runAndWaitForCompletion(worker, popupPage, fixturePage);
    const secondAssessment = await assessFixture(fixturePage);
    assertFixtureAssessment(fixture.name, secondAssessment);
    assert.equal(secondAssessment.translatedCount, firstAssessment.translatedCount);
    assert(providerRequests.length > requestCountBeforeRepeat, `${fixture.name}: repeat did not call provider`);
    if (fixture.name === 'article-basic.html') {
      assert(
        (await getTranslationTexts(fixturePage)).every((text) =>
          text.startsWith('【Mock:textduet-smoke-model-fast:')),
        'model switch was not applied to the repeated translation',
      );
    }

    let dynamicResult;
    if (fixture.name === 'discussion-dynamic.html') {
      const dynamicStartedAt = Date.now();
      await fixturePage.evaluate(() => {
        const template = document.querySelector('#new-comment-template');
        assertTemplate(template);
        document.querySelector('section[aria-label="Comments"]')?.append(template.content.cloneNode(true));

        function assertTemplate(value) {
          if (!(value instanceof HTMLTemplateElement)) {
            throw new Error('dynamic comment template missing');
          }
        }
      });
      await fixturePage.waitForFunction(
        (expectedCount) =>
          document.querySelectorAll('.textduet-translation').length === expectedCount,
        firstAssessment.translatedCount + 1,
        { timeout: 10_000 },
      );
      const assessment = await assessFixture(fixturePage);
      assertFixtureAssessment(fixture.name, assessment);
      assert.equal(assessment.translatedCount, firstAssessment.translatedCount + 1);
      await fixturePage.locator('[data-comment-id="comment-later"] .textduet-translation').evaluate(
        (element) => element.remove(),
      );
      await fixturePage.locator('[data-comment-id="comment-later"] .textduet-translation').waitFor({
        state: 'visible',
        timeout: 10_000,
      });
      dynamicResult = {
        durationMs: Date.now() - dynamicStartedAt,
        addedBlocks: 1,
        automatic: true,
        restoredRemovedTranslation: true,
      };

      await stopFixtureTranslation(worker, popupPage, fixturePage);
      await fixturePage.evaluate(() => {
        const template = document.querySelector('#stopped-comment-template');
        assertTemplate(template);
        document.querySelector('section[aria-label="Comments"]')?.append(
          template.content.cloneNode(true),
        );

        function assertTemplate(value) {
          if (!(value instanceof HTMLTemplateElement)) {
            throw new Error('stopped comment template missing');
          }
        }
      });
      await fixturePage.waitForTimeout(600);
      assert.equal(
        await fixturePage.locator('[data-comment-id="comment-after-stop"] .textduet-translation').count(),
        0,
      );
      await fixturePage.locator('[data-comment-id="comment-after-stop"]').evaluate(
        (element) => element.remove(),
      );
    }

    if (fixture.name === 'dynamic-virtualized.html') {
      dynamicResult = await verifyVirtualizedReliability(
        worker,
        popupPage,
        fixturePage,
      );
    }

    if (fixture.name === 'chroma-research-toc.html') {
      const directoryTranslation = fixturePage.locator('a[href="#signal"] .textduet-translation');
      await directoryTranslation.click();
      assert.equal(new URL(fixturePage.url()).hash, '#signal');
    }

    fixtureResults.push({
      fixture: fixture.name,
      expectedIncludeCount: secondAssessment.expectedIncludeCount,
      translatedCount: secondAssessment.translatedCount,
      excludedCount: secondAssessment.excludedCount,
      duplicateCount: secondAssessment.duplicateCount,
      firstDurationMs: round(firstDurationMs),
      repeatedDurationMs: round(secondDurationMs),
      ...(dynamicResult ? { dynamicResult } : {}),
    });
    await fixturePage.close();
  }

  const recoveryPage = await context.newPage();
  await recoveryPage.goto(new URL('article-basic.html', fixtureBaseUrl).href);
  await installCompletionTracker(recoveryPage);
  await recycleServiceWorker(context, popupPage, worker);
  const recoveryDurationMs = await runAndWaitForCompletion(
    worker,
    popupPage,
    recoveryPage,
  );
  const recoveryAssessment = await assessFixture(recoveryPage);
  assertFixtureAssessment('service-worker-recovery/article-basic.html', recoveryAssessment);
  await recoveryPage.close();

  const untrustedOutputPage = await context.newPage();
  await untrustedOutputPage.goto(new URL('article-basic.html', fixtureBaseUrl).href);
  await installCompletionTracker(untrustedOutputPage);
  const clearCacheResult = await optionsPage.evaluate(() =>
    chrome.runtime.sendMessage({ type: 'CLEAR_TRANSLATION_CACHE' }));
  assert.deepEqual(clearCacheResult, { ok: true, message: '本地翻译缓存已清空' });
  providerMode = 'untrusted-output';
  await runAndWaitForCompletion(worker, popupPage, untrustedOutputPage);
  providerMode = 'normal';
  const untrustedOutput = await assessUntrustedOutput(untrustedOutputPage);
  assert(untrustedOutput.renderedAsText, 'untrusted model output was not rendered as text');
  assert.equal(untrustedOutput.injectedElementCount, 0);
  assert.equal(untrustedOutput.executionMarker, false);
  await untrustedOutputPage.close();

  const performancePage = await context.newPage();
  await performancePage.goto(new URL('article-basic.html', fixtureBaseUrl).href);
  await createPerformanceCorpus(performancePage, 1_000);
  const performance = await benchmarkExtraction(performancePage);
  assert.equal(performance.candidateCount, 1_000);
  assert(performance.maxMs < 100, `extraction exceeded 100ms product target: ${performance.maxMs}ms`);

  await installCompletionTracker(performancePage);
  const fullRunDurationMs = await runAndWaitForCompletion(
    worker,
    popupPage,
    performancePage,
    30_000,
  );
  assert.equal(await performancePage.locator('.textduet-translation').count(), 1_000);
  assert(providerRequests.length > 0);

  console.log(JSON.stringify({
    extensionId,
    browserVersion,
    platform: `${process.platform}-${process.arch}`,
    cpu: cpus()[0]?.model || 'unknown',
    fixtures: fixtureResults,
    performance: {
      candidateCount: performance.candidateCount,
      samplesMs: performance.samplesMs.map(round),
      medianMs: round(performance.medianMs),
      maxMs: round(performance.maxMs),
      targetUnder100Ms: performance.maxMs < 100,
      fullExtensionRunMs: round(fullRunDurationMs),
    },
    providerRequests: providerRequests.length,
    serviceWorkerRecovery: {
      restarted: true,
      translatedCount: recoveryAssessment.translatedCount,
      durationMs: round(recoveryDurationMs),
    },
    untrustedOutput,
  }, null, 2));
} finally {
  try {
    await context?.close();
  } finally {
    await rm(harnessDir, { recursive: true, force: true });
  }
}

async function prepareTestExtension(sourceDir, targetDir, hostPermission) {
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

async function saveTestSettings(page, apiKey) {
  await page.evaluate(async (key) => {
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_PROVIDER_SETTINGS',
      settings: {
        provider: 'openai-compatible',
        baseUrl: 'https://api.example.com/v1',
        model: 'textduet-smoke-model',
        models: ['textduet-smoke-model', 'textduet-smoke-model-fast'],
        apiKeyPersistence: 'local',
        targetLanguage: 'zh-CN',
        displayMode: 'bilingual',
        translationColor: '#b91c1c',
        customSystemPrompt: '',
      },
      apiKey: key,
    });
    if (!response?.ok) {
      throw new Error(response?.message || 'save failed');
    }
  }, apiKey);
}

async function verifyQwenPreset(page) {
  const screenshotDir = resolve('output/playwright');
  await mkdir(screenshotDir, { recursive: true });
  const qwenPreset = page.getByRole('button', { name: '阿里云百炼 Qwen' });
  await qwenPreset.focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('API Base URL').waitFor();
  assert.equal(
    await page.getByLabel('API Base URL').inputValue(),
    'https://dashscope.aliyuncs.com/compatible-mode/v1',
  );
  assert.equal(
    await page.getByLabel('添加模型名称或 code').getAttribute('placeholder'),
    '例如：qwen-plus',
  );
  assert.equal(await qwenPreset.getAttribute('class'), 'preset active');
  assert.equal(await page.getByRole('link', { name: '核对来源' }).count(), 0);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: resolve(screenshotDir, 'options-qwen-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: resolve(screenshotDir, 'options-qwen-narrow.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1280, height: 900 });
}

async function verifySavedM2Settings(page) {
  const activeTag = page.getByRole('button', { name: /textduet-smoke-model.*当前/ });
  await activeTag.waitFor();
  assert.equal(await activeTag.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('button', { name: '删除模型 textduet-smoke-model' }).count(), 1);
  assert.equal(await page.getByRole('button', { name: '删除模型 textduet-smoke-model-fast' }).count(), 1);
  const modelInput = page.getByLabel('添加模型名称或 code');
  await modelInput.fill('temporary-model');
  await modelInput.press('Enter');
  await page.getByRole('button', { name: '删除模型 temporary-model' }).click();
  assert.equal(await page.getByRole('button', { name: '删除模型 temporary-model' }).count(), 0);
  const colorPicker = page.locator('details.color-picker');
  await colorPicker.locator('summary').click();
  assert.equal(
    await page.getByLabel('RGBA 或 # 十六进制').inputValue(),
    '#b91c1c',
  );
  await colorPicker.locator('summary').click();
}

async function seedUsageLedger(page) {
  await page.evaluate(() => {
    const date = new Date();
    const localDate = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('textduet-usage', 1);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('dailyUsage', 'readwrite');
        transaction.objectStore('dailyUsage').put({
          key: `${localDate}:USD:openai-compatible:textduet-smoke-model`,
          date: localDate,
          dateCurrency: `${localDate}:USD`,
          provider: 'openai-compatible',
          model: 'textduet-smoke-model',
          currency: 'USD',
          inputTokens: 1_240,
          outputTokens: 680,
          actualCost: 0.01,
          estimatedCost: 0,
          actualCalls: 1,
          estimatedCalls: 0,
        });
        transaction.objectStore('dailyUsage').put({
          key: `${localDate}:USD:openai-compatible:textduet-smoke-model-fast`,
          date: localDate,
          dateCurrency: `${localDate}:USD`,
          provider: 'openai-compatible',
          model: 'textduet-smoke-model-fast',
          currency: 'USD',
          inputTokens: 320,
          outputTokens: 120,
          actualCost: 0,
          estimatedCost: 0,
          actualCalls: 1,
          estimatedCalls: 0,
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
}

async function verifyUsageDashboard(page) {
  await page.getByRole('heading', { name: 'Token 用量' }).waitFor();
  await page.locator('.usage-chart canvas').waitFor();
  const canvasMetrics = await page.locator('.usage-chart canvas').evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error('usage chart canvas missing');
    const context = element.getContext('2d');
    if (!context) throw new Error('usage chart canvas context missing');
    const pixels = context.getImageData(0, 0, element.width, element.height).data;
    let nonTransparentPixels = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) nonTransparentPixels += 1;
    }
    return { width: element.width, height: element.height, nonTransparentPixels };
  });
  assert(canvasMetrics.width > 0);
  assert(canvasMetrics.height > 0);
  assert(canvasMetrics.nonTransparentPixels > 100);
  const usageText = await page
    .locator('section.settings-card')
    .filter({ has: page.getByRole('heading', { name: 'Token 用量' }) })
    .innerText();
  assert.match(usageText, /1,240/);
  assert.match(usageText, /680/);
  assert.match(usageText, /textduet-smoke-model-fast/);
  assert.match(usageText, /320/);
  const modelFilters = page.locator('.model-filter');
  assert.equal(await modelFilters.filter({ hasText: 'textduet-smoke-model' }).first().getAttribute('aria-pressed'), 'true');
  await modelFilters.filter({ hasText: 'textduet-smoke-model-fast' }).click();
  assert.equal(await modelFilters.filter({ hasText: 'textduet-smoke-model-fast' }).getAttribute('aria-pressed'), 'true');
  assert.doesNotMatch(usageText, /USD\s*0\.01/);
  const screenshotDir = resolve('output/playwright');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: resolve(screenshotDir, 'usage-dashboard-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: resolve(screenshotDir, 'usage-dashboard-narrow.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1280, height: 900 });
}

async function verifyPopupUsage(page) {
  await page.setViewportSize({ width: 360, height: 520 });
  const usageText = await page.locator('.cost-card').innerText();
  assert.match(usageText, /2,360 token/);
  assert.match(usageText, /输入 1,560/);
  assert.match(usageText, /输出 800/);
  assert.doesNotMatch(usageText, /USD\s*0\.01/);
  await page.screenshot({
    path: resolve('output/playwright', 'popup-usage.png'),
    animations: 'disabled',
  });
}

async function verifyPopupModelControls(page) {
  const modelSelect = page.getByLabel('使用模型');
  assert.deepEqual(await modelSelect.locator('option').allTextContents(), [
    'textduet-smoke-model',
    'textduet-smoke-model-fast',
  ]);
  assert.equal(await page.getByRole('button', { name: '停止翻译' }).count(), 0);
}

async function verifyReadingControls(popupPage, fixturePage) {
  const source = fixturePage.locator('[data-td-expect="include"]').first().locator(':scope > .textduet-source');
  const translation = fixturePage.locator('.textduet-translation').first();
  assert.equal(await translation.evaluate((element) => getComputedStyle(element).color), 'rgb(185, 28, 28)');
  const contrastRiskTranslation = fixturePage.locator('.contrast-risk > .textduet-translation');
  assert.equal(
    await contrastRiskTranslation.evaluate((element) => getComputedStyle(element).color),
    'rgb(23, 33, 30)',
    'unsafe model-preferred color did not fall back to the readable source color',
  );

  await popupPage.getByRole('button', { name: '原文', exact: true }).click();
  await fixturePage.waitForFunction(() => document.documentElement.dataset.textduetDisplayMode === 'source-only');
  assert.equal(await translation.evaluate((element) => getComputedStyle(element).display), 'none');
  assert.notEqual(await source.evaluate((element) => getComputedStyle(element).display), 'none');

  await popupPage.getByRole('button', { name: '译文', exact: true }).click();
  await fixturePage.waitForFunction(() => document.documentElement.dataset.textduetDisplayMode === 'translated-only');
  assert.equal(await source.evaluate((element) => getComputedStyle(element).display), 'none');
  assert.notEqual(await translation.evaluate((element) => getComputedStyle(element).display), 'none');

  await popupPage.getByRole('button', { name: '双语', exact: true }).click();
  await fixturePage.waitForFunction(() => document.documentElement.dataset.textduetDisplayMode === 'bilingual');
  await fixturePage.waitForTimeout(3_700);
  assert.equal(await fixturePage.locator('#textduet-status').count(), 0, 'completion tip did not auto-hide');
  await fixturePage.screenshot({
    path: resolve('output/playwright', 'm2-reading-controls.png'),
    fullPage: true,
    animations: 'disabled',
  });
}

async function verifyCompatibilityDiagnostic(page, translatedCount) {
  await page.bringToFront();
  const card = page.getByRole('region', { name: '兼容性诊断' });
  await card.getByRole('heading', { name: '兼容性诊断' }).waitFor();
  await card.getByLabel('问题类型').selectOption('dynamic-content');
  await card.getByRole('checkbox', { name: /包含当前页面路径/ }).check();
  await card.getByRole('button', { name: '生成本地预览' }).click();
  const preview = card.getByLabel('兼容性诊断包预览');
  await preview.waitFor();

  const includedPathDiagnostic = JSON.parse(await preview.textContent());
  assert.equal(includedPathDiagnostic.page.hostname, '127.0.0.1');
  assert.equal(includedPathDiagnostic.page.pathname, '/article-basic.html');
  assert.equal(includedPathDiagnostic.metrics.translatedCount, translatedCount);
  assert.equal(includedPathDiagnostic.issue.type, 'dynamic-content');
  assert.equal(includedPathDiagnostic.screenshotIncluded, false);

  await card.getByRole('checkbox', { name: /包含当前页面路径/ }).uncheck();
  assert.equal(await preview.count(), 0);
  await card.getByRole('button', { name: '生成本地预览' }).click();
  await preview.waitFor();
  const redactedDiagnostic = JSON.parse(await preview.textContent());
  assert.equal('pathname' in redactedDiagnostic.page, false);

  const downloadPromise = page.waitForEvent('download');
  await card.getByRole('button', { name: '下载诊断包' }).click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^textduet-compatibility-\d{4}-\d{2}-\d{2}\.json$/);
}

async function installCompletionTracker(page) {
  await page.evaluate(() => {
    const testWindow = window;
    if (testWindow.__textDuetCompletionTracker) {
      return;
    }
    const tracker = { completeCount: 0, errorCount: 0, lastState: '' };
    const inspect = () => {
      const state = document.querySelector('#textduet-status')?.getAttribute('data-textduet-state') || '';
      if (state !== tracker.lastState) {
        if (state === 'complete') {
          tracker.completeCount += 1;
        }
        if (state === 'error') {
          tracker.errorCount += 1;
        }
        tracker.lastState = state;
      }
    };
    new MutationObserver(inspect).observe(document.documentElement, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    testWindow.__textDuetCompletionTracker = tracker;
  });
}

async function runAndWaitForCompletion(worker, popupPage, fixturePage, timeout = 10_000) {
  const baseline = await fixturePage.evaluate(
    () => ({
      complete: window.__textDuetCompletionTracker?.completeCount || 0,
      error: window.__textDuetCompletionTracker?.errorCount || 0,
    }),
  );
  const startedAt = performance.now();
  const result = await startFixtureTranslation(worker, popupPage, fixturePage);
  assert.deepEqual(result, { ok: true, message: '已开始翻译当前网页' });
  await fixturePage.waitForFunction(
    (previous) => {
      const tracker = window.__textDuetCompletionTracker;
      return (tracker?.completeCount || 0) > previous.complete ||
        (tracker?.errorCount || 0) > previous.error;
    },
    baseline,
    { timeout },
  );
  assert.equal(
    await fixturePage.locator('#textduet-status').getAttribute('data-textduet-state'),
    'complete',
    'fixture translation entered an error state',
  );
  return performance.now() - startedAt;
}

async function runFromPopupAndWaitForCompletion(popupPage, fixturePage, timeout = 10_000) {
  const baseline = await fixturePage.evaluate(
    () => ({
      complete: window.__textDuetCompletionTracker?.completeCount || 0,
      error: window.__textDuetCompletionTracker?.errorCount || 0,
    }),
  );
  await fixturePage.bringToFront();
  await popupPage.reload();
  const startButton = popupPage.getByRole('button', { name: '翻译当前网页' });
  await startButton.waitFor();
  const startedAt = performance.now();
  await startButton.click();
  await popupPage.getByRole('button', { name: '停止翻译' }).waitFor({ timeout: 3_000 });
  await fixturePage.waitForFunction(
    (previous) => {
      const tracker = window.__textDuetCompletionTracker;
      return (tracker?.completeCount || 0) > previous.complete ||
        (tracker?.errorCount || 0) > previous.error;
    },
    baseline,
    { timeout },
  );
  assert.equal(
    await fixturePage.locator('#textduet-status').getAttribute('data-textduet-state'),
    'complete',
    'Popup-started translation entered an error state',
  );
  await popupPage.getByRole('button', { name: '翻译当前网页' }).waitFor({ timeout: 3_000 });
  return performance.now() - startedAt;
}

async function getTranslationTexts(page) {
  return page.locator('.textduet-translation').allTextContents();
}

async function startFixtureTranslation(worker, popupPage, fixturePage) {
  await fixturePage.bringToFront();
  const fixtureTabId = await popupPage.evaluate(async () => {
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

async function stopFixtureTranslation(worker, popupPage, fixturePage) {
  await fixturePage.bringToFront();
  const fixtureTabId = await popupPage.evaluate(async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return activeTab?.id;
  });
  assert.equal(typeof fixtureTabId, 'number');
  const response = await popupPage.evaluate(async (tabId) => {
    await chrome.tabs.update(tabId, { active: true });
    return chrome.runtime.sendMessage({ type: 'STOP_ACTIVE_TAB' });
  }, fixtureTabId);
  assert.deepEqual(response, { ok: true, message: '已停止翻译' });
}

async function recycleServiceWorker(context, extensionPage, currentWorker) {
  const closed = new Promise((resolve) => currentWorker.once('close', resolve));
  const client = await context.newCDPSession(extensionPage);
  await client.send('ServiceWorker.enable');
  await client.send('ServiceWorker.stopAllWorkers');
  await Promise.race([
    closed,
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  const response = await extensionPage.evaluate(() => chrome.runtime.sendMessage({
    type: 'GET_PROVIDER_SETTINGS',
  }));
  assert(response?.hasApiKey, 'service worker did not recover trusted settings');
}

async function verifyVirtualizedReliability(worker, popupPage, fixturePage) {
  const originalRow = fixturePage.locator('[data-virtual-row="reused"]');
  const originalParagraph = originalRow.locator('p');
  await originalRow.evaluate((row) => {
    row.remove();
    const paragraph = row.querySelector('p');
    if (!(paragraph instanceof HTMLParagraphElement)) {
      throw new Error('recycled paragraph missing');
    }
    paragraph.textContent = 'A recycled row now describes a different visible entry.';
    paragraph.dataset.version = 'detached';
    document.querySelector('#virtual-list')?.append(row);
  });
  await originalParagraph.locator(':scope > .textduet-translation').waitFor({
    state: 'visible',
    timeout: 10_000,
  });
  assert.match(
    await originalParagraph.locator(':scope > .textduet-translation').textContent(),
    /A recycled row now describes a different visible entry\.$/,
  );

  await originalParagraph.evaluate((paragraph) => {
    paragraph.textContent = 'The same mounted row changes its source text in place.';
    paragraph.dataset.version = 'in-place';
  });
  await fixturePage.waitForFunction(() =>
    document.querySelector('[data-version="in-place"] > .textduet-translation')?.textContent
      ?.endsWith('The same mounted row changes its source text in place.'),
  { timeout: 10_000 });

  await fixturePage.evaluate(() => {
    const template = document.querySelector('#replacement-body-template');
    if (!(template instanceof HTMLTemplateElement)) {
      throw new Error('replacement body template missing');
    }
    const replacementContent = template.content.querySelector('[data-replacement-body]');
    if (!(replacementContent instanceof HTMLDivElement)) {
      throw new Error('replacement body content missing');
    }
    const replacementBody = document.createElement('body');
    replacementBody.append(...Array.from(replacementContent.childNodes, (node) => node.cloneNode(true)));
    document.documentElement.replaceChild(replacementBody, document.body);
  });
  await fixturePage.locator('[data-version="replaced-body"] > .textduet-translation').waitFor({
    state: 'visible',
    timeout: 10_000,
  });

  await stopFixtureTranslation(worker, popupPage, fixturePage);
  await fixturePage.evaluate(() => {
    const paragraph = document.createElement('p');
    paragraph.dataset.tdExpect = 'include';
    paragraph.dataset.version = 'after-stop';
    paragraph.textContent = 'This entry appears only after the active run has stopped.';
    document.querySelector('#replacement-list')?.append(paragraph);
  });
  await fixturePage.waitForTimeout(600);
  assert.equal(
    await fixturePage.locator('[data-version="after-stop"] > .textduet-translation').count(),
    0,
  );

  return {
    reusedDetachedNode: true,
    updatedMountedNode: true,
    observedReplacementBody: true,
    stoppedAfterReplacement: true,
  };
}

async function snapshotExcludedContent(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('[data-td-expect="exclude"]'))
    .map((element) => ({
      tag: element.tagName,
      text: element.textContent,
      value: 'value' in element ? element.value : undefined,
      translations: element.querySelectorAll('.textduet-translation').length,
    })));
}

async function assessFixture(page) {
  return page.evaluate(() => {
    const includeElements = Array.from(document.querySelectorAll('[data-td-expect="include"]'));
    const excludeElements = Array.from(document.querySelectorAll('[data-td-expect="exclude"]'));
    const directCounts = includeElements.map(
      (element) => element.querySelectorAll(':scope > .textduet-translation').length,
    );
    const translations = Array.from(document.querySelectorAll('.textduet-translation'));
    return {
      expectedIncludeCount: includeElements.length,
      translatedCount: translations.length,
      excludedCount: excludeElements.length,
      missingCount: directCounts.filter((count) => count === 0).length,
      duplicateCount: directCounts.reduce((total, count) => total + Math.max(0, count - 1), 0),
      excludedTranslationCount: excludeElements.reduce(
        (total, element) => total + element.querySelectorAll('.textduet-translation').length,
        0,
      ),
      unexpectedTranslationCount: translations.filter(
        (translation) => translation.parentElement?.getAttribute('data-td-expect') !== 'include',
      ).length,
      allMocked: translations.every((translation) =>
        (translation.textContent || '').startsWith('【Mock:')),
    };
  });
}

async function assessUntrustedOutput(page) {
  return page.evaluate(() => {
    const translations = Array.from(document.querySelectorAll('.textduet-translation'));
    const expectedText = '<img src=x onerror="globalThis.__textDuetExecuted=true"><script>globalThis.__textDuetExecuted=true</script>';
    return {
      renderedAsText: translations.some((translation) => translation.textContent === expectedText),
      injectedElementCount: document.querySelectorAll(
        '.textduet-translation img, .textduet-translation script',
      ).length,
      executionMarker: globalThis.__textDuetExecuted === true,
      originalSourcePresent: document.querySelectorAll('[data-td-expect="include"]').length === 11,
    };
  });
}

function assertFixtureAssessment(fixture, assessment) {
  assert.equal(assessment.missingCount, 0, `${fixture}: expected blocks missing`);
  assert.equal(assessment.duplicateCount, 0, `${fixture}: duplicate translations found`);
  assert.equal(assessment.excludedTranslationCount, 0, `${fixture}: excluded content translated`);
  assert.equal(assessment.unexpectedTranslationCount, 0, `${fixture}: unexpected content translated`);
  assert.equal(
    assessment.translatedCount,
    assessment.expectedIncludeCount,
    `${fixture}: translated count mismatch`,
  );
  assert(assessment.allMocked, `${fixture}: non-mock translation found`);
}

async function createPerformanceCorpus(page, count) {
  await page.evaluate((paragraphCount) => {
    document.body.replaceChildren();
    const main = document.createElement('main');
    const article = document.createElement('article');
    for (let index = 0; index < paragraphCount; index += 1) {
      const paragraph = document.createElement('p');
      paragraph.dataset.tdExpect = 'include';
      paragraph.textContent = `Performance sample paragraph ${index + 1} contains stable readable text.`;
      article.append(paragraph);
    }
    main.append(article);
    document.body.append(main);
  }, count);
}

async function benchmarkExtraction(page) {
  return page.evaluate(() => {
    const selector = 'h1, h2, h3, h4, h5, h6, p, li, blockquote, td, figcaption';
    const excluded = 'script, style, noscript, code, pre, textarea, input, select, button, form, nav, footer, menu, [contenteditable]:not([contenteditable="false"]), [aria-hidden="true"], [hidden], [inert], [role="button"], [role="navigation"], [role="menu"]';
    const samples = [];
    let candidateCount = 0;
    for (let run = 0; run < 8; run += 1) {
      const startedAt = performance.now();
      const candidates = Array.from(document.querySelectorAll(selector)).filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const text = (element.innerText || '').replace(/\s+/g, ' ').trim();
        return !element.closest(excluded) &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0' &&
          rect.width > 0 &&
          rect.height > 0 &&
          text.length >= 2 &&
          text.length <= 4_000;
      });
      const elapsed = performance.now() - startedAt;
      candidateCount = candidates.length;
      if (run > 0) {
        samples.push(elapsed);
      }
    }
    const sorted = [...samples].sort((left, right) => left - right);
    return {
      candidateCount,
      samplesMs: samples,
      medianMs: sorted[Math.floor(sorted.length / 2)],
      maxMs: Math.max(...samples),
    };
  });
}

function round(value) {
  return Math.round(value * 100) / 100;
}
