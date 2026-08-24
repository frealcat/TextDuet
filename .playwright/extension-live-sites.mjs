import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const playwrightEntry = process.env.PLAYWRIGHT_ENTRY;
const builtExtensionDir = process.env.EXTENSION_DIR || resolve('.output/chrome-mv3');
const chromeExecutable = process.env.CHROME_EXECUTABLE;
const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
const skipProviderConnection = process.env.TEXTDUET_SKIP_PROVIDER_CONNECTION === 'true';
const connectionOnly = process.env.TEXTDUET_CONNECTION_ONLY === 'true';
const controlledSampleBlockLimit = 3;
const controlledSampleCharacterLimit = 600;
const provider = readProviderEnvironment();
const configuredSiteIds = new Set(
  (process.env.TEXTDUET_SITE_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const availableSites = [
  {
    id: 'openai-python-readme',
    kind: 'GitHub README',
    url: 'https://github.com/openai/openai-python',
    preferredRoot: 'article.markdown-body, .markdown-body, main',
  },
  {
    id: 'typescript-readme',
    kind: 'GitHub README',
    url: 'https://github.com/microsoft/TypeScript',
    preferredRoot: 'article.markdown-body, .markdown-body, main',
  },
  {
    id: 'chatgpt-capabilities-overview',
    kind: 'ChatGPT 文档',
    url: 'https://help.openai.com/en/articles/9260256-chatgpt-capabilities-overview',
    preferredRoot: 'main article, article, main',
  },
];
const sites = configuredSiteIds.size === 0
  ? availableSites
  : availableSites.filter(({ id }) => configuredSiteIds.has(id));

assert(playwrightEntry, 'PLAYWRIGHT_ENTRY is required');
assert(chromeExecutable, 'CHROME_EXECUTABLE is required');
assert(sites.length > 0, 'TEXTDUET_SITE_IDS did not match a configured live site');

const { chromium } = await import(playwrightEntry);
await mkdir(resolve('.playwright/browser-profile'), { recursive: true });
const harnessDir = await mkdtemp(resolve('.playwright/browser-profile/live-sites-'));
const extensionDir = resolve(harnessDir, 'extension');
const profileDir = resolve(harnessDir, 'profile');
const providerOrigin = new URL(provider.baseUrl).origin;
const providerRequests = [];
const requestsInFlight = new Map();
let context;
let report;

class LiveTestError extends Error {}

try {
  await prepareTestExtension(
    builtExtensionDir,
    extensionDir,
    [
      `${providerOrigin}/*`,
      ...sites.map(({ url }) => `${new URL(url).origin}/*`),
    ],
  );

  context = await chromium.launchPersistentContext(profileDir, {
    executablePath: chromeExecutable,
    headless,
    locale: 'en-US',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 1000 },
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
    ],
  });
  trackProviderRequests(context, providerOrigin, providerRequests, requestsInFlight);

  const worker = await getServiceWorker(context);
  const extensionId = new URL(worker.url()).hostname;
  const extensionOrigin = `chrome-extension://${extensionId}`;
  const optionsPage = await context.newPage();
  await optionsPage.goto(`${extensionOrigin}/options.html`);
  await optionsPage.getByRole('heading', { name: '连接你的翻译模型' }).waitFor();
  await saveProviderSettings(optionsPage, provider);

  const connectionRequestBaseline = providerRequests.length;
  const connectionStartedAt = performance.now();
  const connection = skipProviderConnection
    ? { ok: true, skipped: true }
    : await sendTrustedMessage(optionsPage, { type: 'TEST_PROVIDER' });
  const connectionDurationMs = performance.now() - connectionStartedAt;
  const connectionAttempts = providerRequests.length - connectionRequestBaseline;

  report = {
    runDate: new Date().toISOString(),
    browserVersion: context.browser()?.version() || 'unknown',
    platform: `${process.platform}-${process.arch}`,
    providerConfiguration: {
      apiKeyPresent: true,
      modelPresent: true,
      baseUrlValidated: true,
    },
    connection: {
      ok: Boolean(connection?.ok),
      skipped: Boolean(connection?.skipped),
      category: connection?.ok ? 'success' : classifyProviderFailure(connection?.message),
      durationMs: round(connectionDurationMs),
      providerAttempts: connectionAttempts,
    },
    sites: [],
    providerRequests: [],
  };

  if (!connection?.ok) {
    throw new LiveTestError('Provider connection test failed');
  }

  if (!connectionOnly) {
    for (const site of sites) {
      try {
        report.sites.push({
          ok: true,
          ...await testSite({
            context,
            optionsPage,
            worker,
            site,
            providerRequests,
          }),
        });
      } catch (error) {
        report.sites.push({
          id: site.id,
          kind: site.kind,
          url: site.url,
          ok: false,
          category: classifySiteFailure(error),
          message: sanitizeSiteFailure(error),
        });
      }
    }
  }

  report.providerRequests = summarizeProviderRequests(providerRequests);
  const failedSites = report.sites.filter(({ ok }) => !ok);
  if (failedSites.length > 0) {
    throw new LiveTestError(`${failedSites.length} live-site acceptance check(s) failed`);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  if (report) {
    report.providerRequests = summarizeProviderRequests(providerRequests);
    report.failure = {
      category: error instanceof LiveTestError ? 'acceptance' : 'harness',
      message: sanitizeFailure(error),
    };
    process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
  }
  throw error;
} finally {
  try {
    await context?.close();
  } finally {
    await rm(harnessDir, { recursive: true, force: true });
  }
}

async function testSite({ context, optionsPage, worker, site, providerRequests }) {
  const page = await context.newPage();
  try {
    const response = await page.goto(site.url, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.waitForTimeout(2_500);
    assert(response, `${site.id}: navigation returned no response`);
    assert(response.ok(), `${site.id}: HTTP ${response.status()}`);
    await assertReadablePublicPage(page, site);

    const sample = await prepareControlledSample(
      page,
      site.preferredRoot,
      controlledSampleBlockLimit,
      controlledSampleCharacterLimit,
    );
    assert.equal(
      sample.selectedCount,
      controlledSampleBlockLimit,
      `${site.id}: controlled sample count mismatch`,
    );
    assert.equal(
      sample.candidateCount,
      controlledSampleBlockLimit,
      `${site.id}: production extractor can still see uncontrolled blocks`,
    );
    assert(
      sample.sourceCharacterCount <= controlledSampleCharacterLimit,
      `${site.id}: controlled sample is too large`,
    );

    await installCompletionTracker(page);
    const protectedBefore = await snapshotProtectedContent(page);
    const linksBefore = await snapshotSelectedLinks(page);
    const dashboardBefore = await getCostDashboard(optionsPage);
    const firstRequestBaseline = providerRequests.length;
    const firstDurationMs = await runAndWaitForCompletion(
      worker,
      optionsPage,
      page,
      120_000,
    );
    const firstAssessment = await assessPage(page);
    assertSuccessfulAssessment(site.id, sample.selectedCount, firstAssessment);
    assert.deepEqual(await snapshotProtectedContent(page), protectedBefore);
    assert.deepEqual(await snapshotSelectedLinks(page), linksBefore);
    const dashboardAfterFirst = await getCostDashboard(optionsPage);
    const firstProviderRequests = providerRequests.length - firstRequestBaseline;
    assert(firstProviderRequests >= 1, `${site.id}: first run did not call Provider`);

    const secondRequestBaseline = providerRequests.length;
    const secondDurationMs = await runAndWaitForCompletion(
      worker,
      optionsPage,
      page,
      30_000,
    );
    const secondAssessment = await assessPage(page);
    assertSuccessfulAssessment(site.id, sample.selectedCount, secondAssessment);
    assert.equal(secondAssessment.translatedCount, firstAssessment.translatedCount);
    assert.deepEqual(await snapshotProtectedContent(page), protectedBefore);
    assert.deepEqual(await snapshotSelectedLinks(page), linksBefore);
    const secondProviderRequests = providerRequests.length - secondRequestBaseline;
    assert.equal(secondProviderRequests, 0, `${site.id}: repeated run bypassed local cache`);

    const interaction = await checkDetailsInteraction(page);
    const dashboardAfterSecond = await getCostDashboard(optionsPage);
    assert.deepEqual(dashboardAfterSecond.today, dashboardAfterFirst.today);

    return {
      id: site.id,
      kind: site.kind,
      url: page.url(),
      httpStatus: response.status(),
      controlledSample: sample,
      firstRun: {
        durationMs: round(firstDurationMs),
        providerRequests: firstProviderRequests,
        translatedCount: firstAssessment.translatedCount,
        duplicateCount: firstAssessment.duplicateCount,
        pureTextTranslationCount: firstAssessment.pureTextTranslationCount,
        excludedTranslationCount: firstAssessment.excludedTranslationCount,
        usageDelta: usageDelta(dashboardBefore.today, dashboardAfterFirst.today),
      },
      repeatedRun: {
        durationMs: round(secondDurationMs),
        providerRequests: secondProviderRequests,
        translatedCount: secondAssessment.translatedCount,
        duplicateCount: secondAssessment.duplicateCount,
        cacheHit: secondProviderRequests === 0,
      },
      protections: {
        codeAndPreUnchanged: true,
        selectedLinkTargetsUnchanged: true,
        noTranslationInsideExcludedElements: secondAssessment.excludedTranslationCount === 0,
        detailsInteraction: interaction,
      },
      ledgerStableAfterCacheHit:
        dashboardAfterFirst.today.inputTokens === dashboardAfterSecond.today.inputTokens &&
        dashboardAfterFirst.today.outputTokens === dashboardAfterSecond.today.outputTokens,
    };
  } finally {
    await page.close();
  }
}

function readProviderEnvironment() {
  const requiredKeys = [
    'TEXTDUET_TEST_API_HOST',
    'TEXTDUET_TEST_API_BASE_URL',
    'TEXTDUET_TEST_API_KEY',
    'TEXTDUET_TEST_MODEL',
  ];
  for (const key of requiredKeys) {
    if (!process.env[key]?.trim()) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  const baseUrl = parseSecureUrl(process.env.TEXTDUET_TEST_API_BASE_URL);
  const apiHostOrigin = parseProviderHost(process.env.TEXTDUET_TEST_API_HOST);
  if (baseUrl.origin !== apiHostOrigin) {
    throw new Error('Provider host does not match Provider base URL');
  }
  return {
    baseUrl: baseUrl.href.replace(/\/$/, ''),
    apiKey: process.env.TEXTDUET_TEST_API_KEY.trim(),
    model: process.env.TEXTDUET_TEST_MODEL.trim(),
  };
}

function parseProviderHost(rawValue) {
  const value = rawValue.trim();
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('Provider host is invalid');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Provider host must identify a credential-free HTTPS origin');
  }
  return url.origin;
}

function parseSecureUrl(rawValue) {
  let url;
  try {
    url = new URL(rawValue.trim().replace(/\*$/, ''));
  } catch {
    throw new Error('Provider URL is invalid');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Provider URL must be a credential-free HTTPS URL');
  }
  return url;
}

async function prepareTestExtension(sourceDir, targetDir, hostPermissions) {
  await cp(sourceDir, targetDir, { recursive: true });
  const manifestPath = resolve(targetDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.host_permissions = [
    ...new Set([...(manifest.host_permissions || []), ...hostPermissions]),
  ];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function getServiceWorker(browserContext) {
  const existing = browserContext.serviceWorkers()[0];
  return existing || browserContext.waitForEvent('serviceworker', { timeout: 15_000 });
}

async function saveProviderSettings(page, providerSettings) {
  const result = await page.evaluate(async ({ baseUrl, apiKey, model }) => {
    return chrome.runtime.sendMessage({
      type: 'SAVE_PROVIDER_SETTINGS',
      settings: {
        provider: 'openai-compatible',
        baseUrl,
        model,
        apiKeyPersistence: 'local',
        targetLanguage: 'zh-CN',
        displayMode: 'bilingual',
        customSystemPrompt: '',
      },
      apiKey,
    });
  }, providerSettings);
  assert(result?.ok, 'Provider settings could not be saved');
}

async function sendTrustedMessage(page, message) {
  return page.evaluate((runtimeMessage) => chrome.runtime.sendMessage(runtimeMessage), message);
}

function trackProviderRequests(browserContext, origin, attempts, inFlight) {
  browserContext.on('request', (request) => {
    if (!isProviderRequest(request.url(), origin)) {
      return;
    }
    const attempt = {
      startedAt: performance.now(),
      status: null,
      outcome: 'pending',
      ...extractSafeRequestMetadata(request),
    };
    attempts.push(attempt);
    inFlight.set(request, attempt);
  });
  browserContext.on('response', (response) => {
    const attempt = inFlight.get(response.request());
    if (!attempt) {
      return;
    }
    attempt.status = response.status();
    attempt.outcome = 'response';
    attempt.durationMs = round(performance.now() - attempt.startedAt);
    inFlight.delete(response.request());
  });
  browserContext.on('requestfailed', (request) => {
    const attempt = inFlight.get(request);
    if (!attempt) {
      return;
    }
    attempt.outcome = 'network-failure';
    attempt.durationMs = round(performance.now() - attempt.startedAt);
    inFlight.delete(request);
  });
}

function extractSafeRequestMetadata(request) {
  const metadata = {
    hasThinkingDisabled: false,
    messageCount: null,
    requestBodyCharacters: request.postData()?.length ?? null,
    userContentCharacters: null,
    blockCount: null,
    sourceCharacterCount: null,
  };

  try {
    const payload = request.postDataJSON();
    metadata.hasThinkingDisabled = payload?.enable_thinking === false;
    metadata.messageCount = Array.isArray(payload?.messages) ? payload.messages.length : null;
    const userContent = payload?.messages?.find((message) => message?.role === 'user')?.content;
    metadata.userContentCharacters = typeof userContent === 'string' ? userContent.length : null;
    if (typeof userContent !== 'string') {
      return metadata;
    }

    const translationRequest = JSON.parse(userContent);
    if (!Array.isArray(translationRequest?.blocks)) {
      return metadata;
    }
    metadata.blockCount = translationRequest.blocks.length;
    metadata.sourceCharacterCount = translationRequest.blocks.reduce(
      (sum, block) => sum + (typeof block?.text === 'string' ? block.text.length : 0),
      0,
    );
  } catch {
    // The report deliberately records only safe counts and booleans.
  }

  return metadata;
}

function isProviderRequest(rawUrl, origin) {
  try {
    const url = new URL(rawUrl);
    return url.origin === origin && /\/chat\/completions\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

async function assertReadablePublicPage(page, site) {
  const snapshot = await page.evaluate(() => ({
    title: document.title,
    bodyLength: (document.body?.innerText || '').length,
    hasMain: Boolean(document.querySelector('main, article, .markdown-body')),
  }));
  const challenge = /just a moment|checking your browser|access denied|captcha/i.test(snapshot.title);
  assert(!challenge, `${site.id}: access challenge detected`);
  assert(snapshot.bodyLength > 1_000, `${site.id}: page body is unexpectedly short`);
  assert(snapshot.hasMain, `${site.id}: no readable main content found`);
}

async function prepareControlledSample(page, preferredRootSelector, blockLimit, characterLimit) {
  return page.evaluate(({ rootSelector, blockLimit, characterLimit }) => {
    const selector = 'h1, h2, h3, h4, h5, h6, p, li, blockquote, td, figcaption';
    const excluded = 'script, style, noscript, code, pre, textarea, input, select, button, form, nav, footer, menu, [contenteditable]:not([contenteditable="false"]), [aria-hidden="true"], [hidden], [inert], [role="button"], [role="navigation"], [role="menu"]';
    const root = document.querySelector(rootSelector) || document.querySelector('main, article') || document.body;
    const normalize = (value) => value.replace(/\s+/g, ' ').trim();
    const isVisible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0;
    };
    const isEnglishHeavy = (text) => {
      const asciiLetters = (text.match(/[A-Za-z]/g) || []).length;
      return asciiLetters >= 20 && asciiLetters / text.length >= 0.35;
    };
    const eligible = Array.from(document.querySelectorAll(selector)).filter((element) => {
      const text = normalize(element.innerText || '');
      return root.contains(element) &&
        !element.closest(excluded) &&
        isVisible(element) &&
        text.length >= 20 &&
        text.length <= 900 &&
        isEnglishHeavy(text);
    });
    const eligibleSet = new Set(eligible);
    const leaves = eligible.filter((element) =>
      !Array.from(element.querySelectorAll(selector)).some((descendant) => eligibleSet.has(descendant)),
    );
    const selected = [];
    let totalCharacters = 0;
    const add = (element) => {
      if (!element || selected.includes(element)) {
        return;
      }
      const text = normalize(element.innerText || '');
      if (selected.length >= blockLimit || totalCharacters + text.length > characterLimit) {
        return;
      }
      selected.push(element);
      totalCharacters += text.length;
    };

    add(leaves.find((element) => /^H[1-3]$/.test(element.tagName)));
    for (const element of leaves.filter((candidate) => candidate.tagName === 'P')) {
      if (normalize(element.innerText || '').length >= 70) {
        add(element);
      }
    }
    for (const element of leaves) {
      add(element);
    }

    if (selected.length < blockLimit) {
      throw new Error('Not enough representative English blocks');
    }

    selected.forEach((element, index) => {
      element.dataset.textduetLiveSelected = String(index + 1);
    });
    for (const element of document.querySelectorAll(selector)) {
      if (!selected.includes(element) && !selected.some((candidate) => element.contains(candidate))) {
        element.hidden = true;
        element.dataset.textduetLiveExcluded = 'true';
      }
    }

    const remaining = Array.from(document.querySelectorAll(selector)).filter((element) => {
      const text = normalize(element.innerText || '');
      return !element.closest(excluded) &&
        isVisible(element) &&
        text.length >= 2 &&
        text.length <= 4_000;
    });
    const remainingSet = new Set(remaining);
    const pruned = remaining.filter((element) =>
      !Array.from(element.querySelectorAll(selector)).some((descendant) => remainingSet.has(descendant)),
    );

    return {
      selectedCount: selected.length,
      candidateCount: pruned.length,
      sourceCharacterCount: selected.reduce(
        (sum, element) => sum + normalize(element.innerText || '').length,
        0,
      ),
      headingCount: selected.filter((element) => /^H[1-6]$/.test(element.tagName)).length,
      paragraphCount: selected.filter((element) => element.tagName === 'P').length,
      listItemCount: selected.filter((element) => element.tagName === 'LI').length,
    };
  }, { rootSelector: preferredRootSelector, blockLimit, characterLimit });
}

async function installCompletionTracker(page) {
  await page.evaluate(() => {
    if (window.__textDuetLiveTracker) {
      return;
    }
    const tracker = { completeCount: 0, errorCount: 0, lastState: '' };
    const inspect = () => {
      const state = document.querySelectorAll('.textduet-translation').length > 0 ? 'complete' : '';
      if (state !== tracker.lastState) {
        if (state === 'complete') tracker.completeCount += 1;
        if (state === 'error') tracker.errorCount += 1;
        tracker.lastState = state;
      }
    };
    new MutationObserver(inspect).observe(document.documentElement, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
    window.__textDuetLiveTracker = tracker;
  });
}

async function runAndWaitForCompletion(worker, optionsPage, sitePage, timeout) {
  const baseline = await sitePage.evaluate(() => ({
    complete: window.__textDuetLiveTracker?.completeCount || 0,
    error: window.__textDuetLiveTracker?.errorCount || 0,
  }));
  const startedAt = performance.now();
  const result = await startSiteTranslation(worker, optionsPage, sitePage);
  assert.deepEqual(result, { ok: true, message: '已开始翻译当前网页' });
  await sitePage.waitForFunction(
    (previous) => {
      const tracker = window.__textDuetLiveTracker;
      return (tracker?.completeCount || 0) > previous.complete ||
        (tracker?.errorCount || 0) > previous.error;
    },
    baseline,
    { timeout },
  );
  const finalState = (await sitePage.locator('.textduet-translation').count()) > 0 ? 'complete' : '';
  if (finalState !== 'complete') {
    throw new LiveTestError('Translation produced no translated blocks');
  }
  return performance.now() - startedAt;
}

async function startSiteTranslation(worker, optionsPage, sitePage) {
  await sitePage.bringToFront();
  const siteTabId = await worker.evaluate(async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return activeTab?.id;
  });
  assert.equal(typeof siteTabId, 'number');

  const { activeTabId, response } = await optionsPage.evaluate(async (tabId) => {
    await chrome.tabs.update(tabId, { active: true });
    await new Promise((resolve) => setTimeout(resolve, 150));
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return {
      activeTabId: activeTab?.id,
      response: await chrome.runtime.sendMessage({
        type: 'TRANSLATE_ACTIVE_TAB',
        targetLanguage: 'zh-CN',
      }),
    };
  }, siteTabId);
  assert.equal(activeTabId, siteTabId);
  return response;
}

async function assessPage(page) {
  return page.evaluate(() => {
    const selected = Array.from(document.querySelectorAll('[data-textduet-live-selected]'));
    const translations = Array.from(document.querySelectorAll('.textduet-translation'));
    const directCounts = selected.map(
      (element) => element.querySelectorAll(':scope > .textduet-translation').length,
    );
    const excludedSelector = 'code, pre, textarea, input, select, button, form, nav, footer, menu, [contenteditable]:not([contenteditable="false"]), [aria-hidden="true"], [hidden], [inert], [role="button"], [role="navigation"], [role="menu"]';
    return {
      selectedCount: selected.length,
      translatedCount: translations.length,
      missingCount: directCounts.filter((count) => count === 0).length,
      duplicateCount: directCounts.reduce((sum, count) => sum + Math.max(0, count - 1), 0),
      pureTextTranslationCount: translations.filter((translation) =>
        translation.childNodes.length === 1 &&
        translation.firstChild?.nodeType === Node.TEXT_NODE,
      ).length,
      excludedTranslationCount: Array.from(document.querySelectorAll(excludedSelector)).reduce(
        (sum, element) => sum + element.querySelectorAll('.textduet-translation').length,
        0,
      ),
      translationsOutsideSelection: translations.filter(
        (translation) => !translation.parentElement?.hasAttribute('data-textduet-live-selected'),
      ).length,
    };
  });
}

function assertSuccessfulAssessment(siteId, expectedCount, assessment) {
  assert.equal(assessment.selectedCount, expectedCount, `${siteId}: selected count changed`);
  assert.equal(assessment.translatedCount, expectedCount, `${siteId}: translation count mismatch`);
  assert.equal(assessment.missingCount, 0, `${siteId}: selected blocks are missing translations`);
  assert.equal(assessment.duplicateCount, 0, `${siteId}: duplicate translations found`);
  assert.equal(
    assessment.pureTextTranslationCount,
    assessment.translatedCount,
    `${siteId}: translation was not rendered as plain text`,
  );
  assert.equal(assessment.excludedTranslationCount, 0, `${siteId}: excluded content translated`);
  assert.equal(assessment.translationsOutsideSelection, 0, `${siteId}: unexpected block translated`);
}

async function snapshotProtectedContent(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('pre, code')).slice(0, 20)
    .map((element) => ({
      tag: element.tagName,
      text: element.textContent,
      translations: element.querySelectorAll('.textduet-translation').length,
    })));
}

async function snapshotSelectedLinks(page) {
  return page.evaluate(() => Array.from(
    document.querySelectorAll('[data-textduet-live-selected] a[href]'),
  ).map((anchor) => anchor.href));
}

async function checkDetailsInteraction(page) {
  const details = page.locator('details:visible').first();
  if (await details.count() === 0) {
    return 'not-present';
  }
  const before = await details.evaluate((element) => element.open);
  const summary = details.locator('summary').first();
  if (await summary.count() === 0) {
    return 'summary-not-present';
  }
  await summary.click();
  const after = await details.evaluate((element) => element.open);
  await details.evaluate((element, original) => {
    element.open = original;
  }, before);
  assert.notEqual(after, before, 'details interaction did not toggle');
  return 'toggle-passed';
}

async function getCostDashboard(page) {
  const dashboard = await sendTrustedMessage(page, { type: 'GET_COST_DASHBOARD' });
  assert(dashboard?.today, 'Cost dashboard is unavailable');
  return dashboard;
}

function usageDelta(before, after) {
  return {
    inputTokens: after.inputTokens - before.inputTokens,
    outputTokens: after.outputTokens - before.outputTokens,
    actualCost: roundMoney(after.actualCost - before.actualCost),
    estimatedCost: roundMoney(after.estimatedCost - before.estimatedCost),
    currency: after.currency,
    hasActualUsage: after.hasActualUsage,
    hasEstimatedUsage: after.hasEstimatedUsage,
    budgetEnabled: after.budgetEnabled,
  };
}

function summarizeProviderRequests(attempts) {
  return attempts.map(({
    status,
    outcome,
    durationMs,
    hasThinkingDisabled,
    messageCount,
    requestBodyCharacters,
    userContentCharacters,
    blockCount,
    sourceCharacterCount,
  }) => ({
    status,
    outcome,
    durationMs: durationMs ?? null,
    hasThinkingDisabled,
    messageCount,
    requestBodyCharacters,
    userContentCharacters,
    blockCount,
    sourceCharacterCount,
  }));
}

function classifySiteFailure(error) {
  const message = String(error?.message || '').toLowerCase();
  if (/http 401|http 403|access challenge/.test(message)) return 'site-access-protection';
  if (/http \d{3}/.test(message)) return 'site-http';
  if (/navigation|page body|readable main|net::/.test(message)) return 'site-unavailable';
  if (/translation failed/.test(message)) return 'translation';
  if (error instanceof assert.AssertionError) return 'acceptance';
  return 'harness';
}

function sanitizeSiteFailure(error) {
  if (error instanceof LiveTestError || error instanceof assert.AssertionError) {
    return error.message;
  }
  return 'Live-site check failed';
}

function classifyProviderFailure(message) {
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

function sanitizeFailure(error) {
  if (error instanceof LiveTestError) {
    return error.message;
  }
  if (error instanceof assert.AssertionError) {
    return error.message;
  }
  return 'Live-site harness failed';
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function roundMoney(value) {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}
