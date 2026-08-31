import type {
  RuntimeMessage,
  TranslationBatchResponse,
  TranslationBlock,
  TranslationDisplayMode,
} from '@/src/core/contracts';
import { formatMoneyAmount } from '@/src/core/cost';
import { DEFAULT_TRANSLATION_COLOR } from '@/src/core/defaults';
import {
  OperationResultSchema,
  parseRuntimeMessage,
  TranslationBatchResponseSchema,
  TranslationEstimateResponseSchema,
  parseTranslationStreamEvent,
} from '@/src/core/schemas';
import { createTranslationBatches } from '@/src/core/translation-planning';
import {
  injectPageStyles,
  getPageTranslationState,
  SOURCE_BLOCK_ID_ATTRIBUTE,
  SELECTION_QUICK_ACTION_CLASS,
  setTranslationColor,
  setTranslationDisplayMode,
  updatePageStatus,
} from '@/src/translator/page-status';
import {
  describeUsageRecording,
  summarizePageEstimates,
  type UsageRecordingStatus,
} from '@/src/translator/estimate-status';
import { collectTranslationCandidates } from '@/src/translator/dom-extraction';
import {
  clearCandidate,
  clearIneligibleManagedSources,
  DYNAMIC_CONTENT_SCAN_DELAY_MS,
  isCurrentSourceText,
  readTextWithoutTranslations,
  observeDynamicContent,
} from '@/src/translator/dynamic-content';
import {
  removeRenderedTranslations,
  reconcileRenderedTranslation,
  renderTranslations,
} from '@/src/translator/render-translations';
import { resolveSiteRule } from '@/src/translator/site-rules';
import { collectStyleContext } from '@/src/translator/style-context';
import { captureSelectionAnchor, getCapturedSelection, renderSelectionError, renderSelectionTranslation } from '@/src/translator/selection-translation';
import { normalizeSelectionError } from '@/src/translator/selection-errors';
import {
  applyLocale,
  type LanguagePreference,
  resolveActiveLocale,
  t,
} from '@/src/i18n/translator-runtime';
import { bindCachedTranslation, TranslationMemory } from '@/src/translator/translation-memory';
import { advanceViewGeneration, isCurrentView } from '@/src/translator/view-generation';
import {
  isRetryableTranslationError,
  normalizeTranslationStreamSendError,
  requeueAfterLifecycleDisconnect,
  TranslationLifecycleDisconnectError,
} from '@/src/translator/stream-errors';
import { createLeadingThrottle } from '@/src/translator/scheduler-helper';
import type { TranslatedBlock } from '@/src/core/contracts';

const INSTALL_MARKER = '__textDuetInstalled';
type TranslatorGlobal = typeof globalThis & {
  [INSTALL_MARKER]?: boolean;
};

let activeRunId = 0;
let nextBlockId = 0;
const activeStreamPorts = new Set<Browser.runtime.Port>();
const idsByElement = new WeakMap<HTMLElement, string>();
const sourceTextByElement = new WeakMap<HTMLElement, string>();
let activeRun: TranslationRun | null = null;
// Nodes whose page-owned text changed since their previous scan. This is
// cleared after each scan and prevents a reused SPA node from inheriting the
// previous route's translation or failure suppression.
let sourceTextChangedInScan = new Set<HTMLElement>();
let lastRunSnapshot: {
  candidateCount: number;
  translatedCount: number;
  failedBatchCount: number;
} | null = null;

interface TranslationRun {
  id: number;
  /** Incremented whenever the SPA replaces the current view. In-flight work
   * from an older generation may finish, but it must never touch the new DOM. */
  viewGeneration: number;
  sourceLanguage: string;
  targetLanguage: string;
  displayMode: TranslationDisplayMode;
  translationColor: string;
  selectionQuickAction: boolean;
  headerPopupRescan: boolean;
  forceRefresh: boolean;
  observer: import('@/src/translator/dynamic-content').DynamicContentHandle | null;
  scanTimer: number | undefined;
  retryTimer: number | undefined;
  isProcessing: boolean;
  hasPendingScan: boolean;
  translatedIds: Set<string>;
  failedIds: Set<string>;
  seenIds: Set<string>;
  failedBatchCount: number;
  /**
   * In-memory reuse scoped to this page run. Cross-tab and persistent reuse
   * are resolved by the trusted Service Worker cache.
   */
  memory: import('@/src/translator/translation-memory').TranslationMemory | null;
  /**
   * L5: model identifier used as part of the content-hash key so
   * different model answers for the same text do not collide.
   */
  modelHint: string;
  /**
   * L6: when true, `renderTranslations` uses the `CSS.highlights`
   * strategy instead of the DOM-wrapper `adjacent` strategy. Toggled
   * per-run by the future Options UI.
   */
  useHighlightStrategy: boolean;
}
export default defineUnlistedScript(() => {
  const translatorGlobal = globalThis as TranslatorGlobal;
  if (translatorGlobal[INSTALL_MARKER]) {
    return;
  }
  translatorGlobal[INSTALL_MARKER] = true;

  // Apply the user's language preference for in-page messages.
  // The translator script does not have direct access to providerSettings,
  // so it reads browser locale as a reasonable default. The actual
  // language is set by the Options or Popup App via runtime messages
  // (future work) or by reading navigator.language here.
  try {
    const pref: LanguagePreference = 'auto';
    applyLocale(resolveActiveLocale(), pref);
  } catch {
    // ignore: navigator may be unavailable in some page contexts
  }

  injectPageStyles();
  browser.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
    const parsedMessage = parseRuntimeMessageSafely(rawMessage);
    if (!parsedMessage) {
      return false;
    }

    if (parsedMessage.type === 'START_PAGE_TRANSLATION') {
      startTranslationRun(
        parsedMessage.sourceLanguage ?? 'auto',
        parsedMessage.targetLanguage,
        parsedMessage.displayMode ?? 'bilingual',
        parsedMessage.translationColor ?? DEFAULT_TRANSLATION_COLOR,
        parsedMessage.selectionQuickAction === true,
        parsedMessage.headerPopupRescan === true,
        parsedMessage.forceRefresh ?? true,
      );
      sendResponse({ ok: true, message: t('translator.message.startedPage') });
      return false;
    }

    if (parsedMessage.type === 'TRANSLATE_SELECTION') {
      captureSelectionAnchor();
      void translateSelection(parsedMessage.text, parsedMessage.sourceLanguage, parsedMessage.targetLanguage, parsedMessage.translationColor);
      sendResponse({ ok: true, message: t('translator.message.startedSelection') });
      return false;
    }

    if (parsedMessage.type === 'CONFIGURE_SELECTION_QUICK_ACTION') {
      if (parsedMessage.enabled) {
        installSelectionQuickAction({
          ...createSelectionRun(parsedMessage.targetLanguage || 'en'),
          id: 0, selectionQuickAction: true,
          sourceLanguage: parsedMessage.sourceLanguage || 'auto',
          translationColor: parsedMessage.translationColor || DEFAULT_TRANSLATION_COLOR,
        });
      } else {
        removeSelectionQuickAction();
      }
      sendResponse({ ok: true, message: t('translator.message.quickActionUpdated') });
      return false;
    }

    if (parsedMessage.type === 'STOP_PAGE_TRANSLATION') {
      stopActiveRun();
      updatePageStatus(t('translator.status.stopped'), 'stopped');
      sendResponse({ ok: true, message: t('translator.message.stopped') });
      return false;
    }

    if (parsedMessage.type === 'SET_PAGE_DISPLAY_MODE') {
      setTranslationDisplayMode(parsedMessage.displayMode);
      if (activeRun) activeRun.displayMode = parsedMessage.displayMode;
      sendResponse({ ok: true, message: t('translator.message.displayModeChanged') });
      return false;
    }

    if (parsedMessage.type === 'GET_TRANSLATION_STATE') {
      sendResponse(getPageTranslationState());
      return false;
    }

    if (parsedMessage.type === 'GET_TRANSLATION_DIAGNOSTIC') {
      const snapshot = activeRun
        ? {
            candidateCount: activeRun.seenIds.size,
            translatedCount: activeRun.translatedIds.size,
            failedBatchCount: activeRun.failedBatchCount,
          }
        : lastRunSnapshot;
      sendResponse({
        candidateCount: snapshot?.candidateCount || 0,
        translatedCount: snapshot?.translatedCount || 0,
        failedBatchCount: snapshot?.failedBatchCount || 0,
        hasRun: snapshot !== null,
      });
      return false;
    }

    return false;
  });
});

function startTranslationRun(
  sourceLanguage: string,
  targetLanguage: string,
  displayMode: TranslationDisplayMode,
  translationColor: string,
  selectionQuickAction: boolean,
  headerPopupRescan: boolean,
  forceRefresh: boolean,
): void {
  stopActiveRun();
  // A previous run may have observed a mutation immediately before it was
  // stopped. Those element references are page-owned state, not a reason to
  // invalidate the first scan of the new run.
  sourceTextChangedInScan.clear();
  removeRenderedTranslations();
  setTranslationDisplayMode(displayMode);
  setTranslationColor(translationColor);
  updatePageStatus(t('translator.status.checkingContent'), 'progress');
  const runId = ++activeRunId;
  const run: TranslationRun = {
    id: runId,
    viewGeneration: 0,
    sourceLanguage,
    targetLanguage,
    displayMode,
    translationColor,
    selectionQuickAction,
    headerPopupRescan,
    forceRefresh,
    observer: null,
    scanTimer: undefined,
    retryTimer: undefined,
    isProcessing: false,
    hasPendingScan: false,
    translatedIds: new Set(),
    failedIds: new Set(),
    seenIds: new Set(),
    failedBatchCount: 0,
    // L5: enabled when the user has not opted out via the future Options
    // toggle. The memory is created per run so its L1 WeakMap does not
    // outlive the run and leak node references after the SPA navigates.
    memory: createRunMemory(),
    // L5: modelHint is part of the cache key. We pass an empty string
    // for now; the future Options UI will surface model selection and
    // feed this through.
    modelHint: '',
    // L6: off by default. The DOM-wrapper `adjacent` strategy is
    // visually identical to what users have been seeing and has the
    // strongest browser support. Opt-in via Options in a later round.
    useHighlightStrategy: false,
  };
  activeRun = run;
  installSelectionQuickAction(run);
  if (headerPopupRescan) installHeaderPopupRescan(run);
  run.observer = observeDynamicContent(sourceTextByElement, (changedElements) => {
    if (!isActiveRun(run.id)) return;
    for (const element of changedElements || []) {
      const id = idsByElement.get(element);
      if (!id) continue;
      // Mutation cleanup has already refreshed the source snapshot. Clear
      // terminal bookkeeping here so a stable SPA node can translate its new
      // text even when the prior request failed.
      run.failedIds.delete(id);
      run.translatedIds.delete(id);
    }
    scheduleScan(run, DYNAMIC_CONTENT_SCAN_DELAY_MS);
  });
  installSpaNavigationReset(run);
  scheduleScan(run, 0);
}

function stopActiveRun(): void {
  activeRunId += 1;
  activeStreamPorts.forEach((port) => port.disconnect());
  activeStreamPorts.clear();
  removeSelectionQuickAction();
  removeHeaderPopupRescan();
  if (!activeRun) return;
  lastRunSnapshot = {
    candidateCount: activeRun.seenIds.size,
    translatedCount: activeRun.translatedIds.size,
    failedBatchCount: activeRun.failedBatchCount,
  };
  removeSpaNavigationReset();
  activeRun.observer?.disconnect();
  if (activeRun.scanTimer !== undefined) window.clearTimeout(activeRun.scanTimer);
  if (activeRun.retryTimer !== undefined) window.clearTimeout(activeRun.retryTimer);
  sourceTextChangedInScan.clear();
  // Release page-scoped cached translations when the run ends.
  activeRun.memory?.dispose();
  activeRun.memory = null;
  activeRun = null;
}

function scheduleScan(run: TranslationRun, delayMs: number): void {
  if (run.id !== 0 && !isActiveRun(run.id)) return;
  run.hasPendingScan = true;
  if (run.isProcessing || run.scanTimer !== undefined) return;
  run.scanTimer = window.setTimeout(() => {
    run.scanTimer = undefined;
    void processLoadedContent(run);
  }, delayMs);
}

async function processLoadedContent(run: TranslationRun): Promise<void> {
  if (!isActiveRun(run.id) || run.isProcessing) return;
  run.isProcessing = true;

  try {
    while (isActiveRun(run.id) && run.hasPendingScan) {
      run.hasPendingScan = false;
      const viewGeneration = run.viewGeneration;
      const loadedCandidates = collectCandidates();
      // A reused SPA node may not emit a mutation before a visibility or
      // pageshow scan. `getSourceText` records such changes; clear the old
      // owned output before accepting the new snapshot, otherwise the stable
      // element id can make the previous route's translation look current.
      loadedCandidates.forEach(({ element }) => {
        if (sourceTextChangedInScan.has(element)) {
          clearCandidateForCurrentScan(element, run);
        } else if (sourceTextByElement.get(element) === undefined) {
          sourceTextByElement.set(element, readTextWithoutTranslations(element));
        }
      });
      sourceTextChangedInScan.clear();
      // Candidate eligibility can change without changing source text. For
      // example, a framework may add `hidden`, `aria-hidden`, `role="button"`,
      // or an excluded ancestor class to an already translated node. Remove
      // only stale managed owners before reconciliation so the next scan can
      // safely re-admit the node if the page makes it readable again.
      const eligibleElements = new Set(loadedCandidates.map(({ element }) => element));
      const ineligibleElements = clearIneligibleManagedSources(
        document,
        eligibleElements,
        sourceTextByElement,
      );
      for (const element of ineligibleElements) {
        const id = element.getAttribute(SOURCE_BLOCK_ID_ATTRIBUTE);
        if (!id) continue;
        run.failedIds.delete(id);
        run.translatedIds.delete(id);
      }
      loadedCandidates.forEach(({ id }) => run.seenIds.add(id));
      const renderedByElement = new Map<HTMLElement, HTMLElement | null>();
      for (const { id, element } of loadedCandidates) {
        const existing = reconcileRenderedTranslation(element, id);
        renderedByElement.set(element, existing);
        if (existing?.lang === run.targetLanguage) run.translatedIds.add(id);
      }
      const candidates = loadedCandidates.filter(({ id, element }) => {
        if (run.failedIds.has(id)) return false;
        const existing = renderedByElement.get(element);
        return !existing || existing.lang !== run.targetLanguage;
      });

      if (candidates.length === 0) {
        if (run.translatedIds.size === 0) {
          updatePageStatus(t('translator.status.noContent'), 'empty');
        } else {
          updatePageStatus(
            `当前已加载内容已翻译，共 ${run.translatedIds.size} 段；继续监听滚动加载的新内容`,
            'complete',
          );
        }
        continue;
      }

      candidates.sort(compareCandidatePriority);
      // Split page-run memory hits from misses. Persistent and cross-tab
      // cache lookup remains inside the Service Worker request path.
      let cached: Array<{ candidate: TranslationBlock & { element: HTMLElement }; block: TranslatedBlock }> = [];
      let toTranslate = candidates;
      if (run.memory) {
        type Lookup = {
          candidate: TranslationBlock & { element: HTMLElement };
          hit: TranslatedBlock | null;
        };
        const lookups: Lookup[] = await Promise.all(
          candidates.map(async (candidate): Promise<Lookup> => {
            const hit = await run.memory!.get(
              candidate.text,
              run.targetLanguage,
              run.modelHint,
              candidate.element,
            );
            return { candidate, hit };
          }),
        );
        cached = [];
        toTranslate = [];
        for (const entry of lookups) {
          if (entry.hit) {
            // The renderer joins by current DOM ID, so rebind only the
            // cached result and still render every real DOM occurrence.
            cached.push({
              candidate: entry.candidate,
              block: bindCachedTranslation(entry.hit, entry.candidate.id),
            });
          } else {
            toTranslate.push(entry.candidate);
          }
        }
      }
      // Cache lookups can yield while the page changes eligibility. Filter
      // both cache hits and provider misses against a fresh candidate set
      // before rendering or sending any text to the Provider; otherwise a
      // node that just became hidden/interactive could still be submitted in
      // the same scan.
      if (cached.length > 0 || toTranslate.length > 0) {
        const currentCandidatesByElement = getCurrentCandidatesByElement();
        const isCurrentCandidate = (candidate: TranslationBlock & { element: HTMLElement }): boolean =>
          isCurrentCandidateSnapshot(candidate, currentCandidatesByElement)
            && isCurrentSourceText(candidate.element, candidate.text);
        const currentCached = cached.filter(({ candidate }) => isCurrentCandidate(candidate));
        const currentToTranslate = toTranslate.filter(isCurrentCandidate);
        if (currentCached.length !== cached.length || currentToTranslate.length !== toTranslate.length) {
          scheduleScan(run, 0);
        }
        cached = currentCached;
        toTranslate = currentToTranslate;
      }
      // Render cache hits immediately so the user sees the first
      // paint before the model request starts. This also covers the
      // case where the model call is slow or fails — cached blocks
      // remain on the page regardless.
      if (cached.length > 0) {
        if (!isCurrentRunView(run, viewGeneration)) return;
        try {
          renderTranslations(
            cached.map((entry) => entry.candidate),
            cached.map((entry) => entry.block),
            run.targetLanguage,
            { useHighlight: run.useHighlightStrategy },
          );
        } catch {
          // Rendering should not throw, but if it does we just skip
          // the cache hits for this round — the next scan will retry.
        }
        cached.forEach((entry) => {
          run.translatedIds.add(entry.candidate.id);
        });
        if (cached.length > 0) {
          updatePageStatus(
            `命中本地缓存 ${cached.length} 段，无需调用模型`,
            'progress',
          );
        }
      }
      if (toTranslate.length === 0) continue;
      try {
        const freshBlocks = await translateCandidatesAndCollect(toTranslate, run, viewGeneration);
        if (!isCurrentRunView(run, viewGeneration)) return;
        // Keep model answers only for the remainder of this page run.
        if (run.memory) {
          const candidatesById = new Map(toTranslate.map((candidate) => [candidate.id, candidate]));
          for (const block of freshBlocks) {
            const candidate = candidatesById.get(block.id);
            if (!candidate) continue;
            await run.memory.put(
              candidate.text,
              run.targetLanguage,
              run.modelHint,
              block,
              candidate.element,
            );
          }
        }
      } catch (error) {
        // A navigation can race a rejected request. Once the generation has
        // advanced, this response belongs to the old view and must not write
        // its ids into the new view's terminal failure set.
        if (!isCurrentRunView(run, viewGeneration)) return;
        if (isRetryableTranslationError(error)) {
          // bfcache/page freeze disconnects are expected lifecycle events, not
          // provider failures. Leave ids eligible for the next visible scan.
          requeueAfterLifecycleDisconnect(run.failedIds, toTranslate.map(({ id }) => id));
          scheduleLifecycleRetry(run);
          return;
        }
        run.failedBatchCount += 1;
        toTranslate.forEach(({ id }) => run.failedIds.add(id));
        if (isActiveRun(run.id)) {
          updatePageStatus(error instanceof Error ? error.message : t('translator.status.translateFailed'), 'error');
        }
      }
    }
  } finally {
    run.isProcessing = false;
    if (run.hasPendingScan) scheduleScan(run, 0);
  }
}

async function translateCandidates(
  candidates: Array<TranslationBlock & { element: HTMLElement }>,
  run: TranslationRun,
): Promise<void> {
  await translateCandidatesAndCollect(candidates, run, run.viewGeneration);
}

/**
 * Returns fresh model outputs in input order so the caller can retain them
 * in per-page memory. The visible behaviour (status text, cost recording,
 * cache hit count) is identical to
 * `translateCandidates`; the only difference is the return value.
 */
async function translateCandidatesAndCollect(
  candidates: Array<TranslationBlock & { element: HTMLElement }>,
  run: TranslationRun,
  viewGeneration: number = run.viewGeneration,
): Promise<TranslatedBlock[]> {
  const { targetLanguage } = run;
  const styledCandidates = candidates.map((candidate) => ({
    ...candidate,
    styleContext: collectStyleContext(candidate.element, run.translationColor),
  }));
  const batches = createTranslationBatches(
    styledCandidates.map(({ id, text, styleContext }) => ({ id, text, styleContext })),
  );

  // Cost estimation runs alongside the first model request so it cannot delay
  // the first visible translation block. It remains informational if it fails.
  const estimatesPromise = Promise.all(
    batches.map((blocks) => requestTranslationEstimate(blocks, targetLanguage, run.forceRefresh)),
  ).catch(() => []);
  const initialEstimate = summarizePageEstimates([], candidates.length);
  updatePageStatus(t('translator.status.preparingFirst'), 'progress');

  let recordedAmount = 0;
  let latestTodayAmount = initialEstimate.todayTotalCost;
  let latestThreshold: 50 | 80 | 100 | undefined;
  const usageRecordingStatuses: UsageRecordingStatus[] = [];
  let cacheHitCount = 0;
  let isCacheAvailable = initialEstimate.isCacheAvailable;

  // Keep model outputs keyed by their validated block id. Providers and the
  // cache service normally preserve request order, but that is not a safe
  // contract to rely on when a stream interleaves blocks or a future adapter
  // changes its merge order.
  const freshBlocksById = new Map<string, TranslatedBlock>();
  const getFreshBlocks = (): TranslatedBlock[] => candidates
    .map((candidate) => freshBlocksById.get(candidate.id))
    .filter((block): block is TranslatedBlock => block !== undefined);

  for (const [batchIndex, blocks] of batches.entries()) {
    if (!isCurrentRunView(run, viewGeneration)) {
      return getFreshBlocks();
    }

    updatePageStatus(`正在翻译第 ${batchIndex + 1}/${batches.length} 批（共 ${candidates.length} 段）…`, 'progress');

    let response: TranslationBatchResponse;
    try {
      response = await streamBatch(
        { sourceLanguage: run.sourceLanguage, targetLanguage, forceRefresh: run.forceRefresh, blocks },
        styledCandidates,
        run,
      );
    } catch (error) {
      // Navigation intentionally disconnects in-flight ports. Treat that
      // cancellation as stale work rather than marking the new view's ids as
      // failed and suppressing their next translation attempt.
      if (!isCurrentRunView(run, viewGeneration)) return getFreshBlocks();
      throw error;
    }

    if (!isCurrentRunView(run, viewGeneration)) {
      return getFreshBlocks();
    }
    const currentCandidatesByElement = getCurrentCandidatesByElement();
    const currentBatch = blocks.filter((block) => {
      const candidate = styledCandidates.find((entry) => entry.id === block.id);
      return candidate
        ? isCurrentCandidateSnapshot(candidate, currentCandidatesByElement)
          && isCurrentSourceText(candidate.element, candidate.text)
        : false;
    });
    if (currentBatch.length !== blocks.length) {
      // The page changed while this batch was in flight or between batches.
      // Never commit a response against a stale source snapshot; a scheduled
      // reconciliation scan will clear the old output and retry the new text.
      scheduleScan(run, 0);
      return getFreshBlocks();
    }
    // Reconcile the complete batch after the stream closes. This is idempotent
    // and covers providers that emit a validated envelope only at completion.
    renderTranslations(styledCandidates, response.blocks, run.targetLanguage, { useHighlight: run.useHighlightStrategy });

    recordedAmount += response.cost.amount;
    latestTodayAmount = response.cost.today.totalCost;
    latestThreshold = response.cost.crossedThresholds.at(-1) || latestThreshold;
    usageRecordingStatuses.push({
      usageKind: response.usage.kind,
      isLedgerRecorded: response.cost.isLedgerRecorded,
    });
    cacheHitCount += response.cache.hitCount;
    isCacheAvailable &&= response.cache.isAvailable;
    response.blocks.forEach(({ id }) => run.translatedIds.add(id));
    response.blocks.forEach((block) => freshBlocksById.set(block.id, block));
  }

  const estimate = summarizePageEstimates(await estimatesPromise, candidates.length);
  const { currency, isPriceConfigured } = estimate;
  const costMessage = isPriceConfigured
    ? `；本次${formatMoneyAmount(recordedAmount, currency)}，今日${formatMoneyAmount(latestTodayAmount, currency)}`
    : '';
  const thresholdMessage = latestThreshold
    ? `；今日用量已达到预算 ${latestThreshold}%${latestThreshold === 100 ? '（仅提醒，不会自动阻止）' : ''}`
    : '';
  const ledgerMessage = describeUsageRecording(usageRecordingStatuses);
  const cacheMessage = cacheHitCount > 0
    ? `；本地缓存命中 ${cacheHitCount}/${candidates.length} 段`
    : '';
  const cacheWarning = isCacheAvailable ? '' : '；本地缓存暂时不可用';
  const hasPendingContent = run.hasPendingScan;
  updatePageStatus(
    hasPendingContent
      ? `已处理 ${run.translatedIds.size} 段${cacheMessage}${costMessage}${thresholdMessage}${ledgerMessage}${cacheWarning}；页面内容有更新，正在继续检查`
      : `已翻译当前加载内容，共处理 ${run.translatedIds.size} 段${cacheMessage}${costMessage}${thresholdMessage}${ledgerMessage}${cacheWarning}；继续监听滚动加载的新内容`,
    hasPendingContent ? 'progress' : 'complete',
  );
  return getFreshBlocks();
}

async function streamBatch(
  request: { sourceLanguage: string; targetLanguage: string; forceRefresh: boolean; blocks: TranslationBlock[] },
  styledCandidates: Array<TranslationBlock & { element: HTMLElement }>,
  run: TranslationRun,
  onBlock?: (block: import('@/src/core/contracts').TranslatedBlock) => void,
): Promise<TranslationBatchResponse> {
  // Connecting can throw synchronously when the page is entering bfcache or
  // the extension context is being torn down. Normalize that lifecycle
  // failure before the scan loop can classify the batch as a provider error.
  let port: Browser.runtime.Port;
  try {
    port = browser.runtime.connect({ name: 'textduet-translation-stream' });
  } catch (error) {
    throw normalizeTranslationStreamSendError(error);
  }
  activeStreamPorts.add(port);
  // Capture the view generation at request creation. A SPA navigation can
  // leave the run itself active while replacing the DOM; a late completion
  // from the old view must therefore be treated as stale even when run.id
  // still matches.
  const viewGeneration = run.viewGeneration;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      activeStreamPorts.delete(port);
      callback();
      window.setTimeout(() => port.disconnect(), 0);
    };
    port.onMessage.addListener((rawEvent: unknown) => {
      try {
        const event = parseTranslationStreamEvent(rawEvent);
        if (event.type === 'TRANSLATION_BLOCK') {
          // Older workers may still send block events. Buffer them and wait
          // for the complete envelope so a later stream error cannot leave a
          // partial translation in the page.
          return;
        }
        if (event.type === 'TRANSLATION_COMPLETE') {
          if (isCurrentRunView(run, viewGeneration)) {
            event.response.blocks.forEach(({ id }) => run.translatedIds.add(id));
            if (onBlock) event.response.blocks.forEach(onBlock);
          }
          finish(() => resolve(event.response));
          return;
        }
        finish(() => reject(new Error(event.message)));
      } catch (error) {
        finish(() => reject(error));
      }
    });
    port.onDisconnect.addListener(() => {
      activeStreamPorts.delete(port);
      if (!settled) {
        settled = true;
        reject(new TranslationLifecycleDisconnectError());
      }
    });
    try {
      port.postMessage({ type: 'TRANSLATE_BATCH_STREAM', request });
    } catch (error) {
      // `postMessage` can throw synchronously when the tab enters bfcache or
      // navigates between connect() and the first send. Use the same cleanup
      // path as asynchronous stream errors so the port cannot remain in the
      // active set and suppress later cancellation.
      finish(() => reject(normalizeTranslationStreamSendError(error)));
    }
  });
}

async function requestTranslationEstimate(
  blocks: TranslationBlock[],
  targetLanguage: string,
  forceRefresh: boolean,
) {
  const rawResponse: unknown = await browser.runtime.sendMessage({
    type: 'ESTIMATE_TRANSLATION',
    request: { sourceLanguage: activeRun?.sourceLanguage || 'auto', targetLanguage, forceRefresh, blocks },
  } satisfies RuntimeMessage);
  const response = TranslationEstimateResponseSchema.safeParse(rawResponse);
  if (!response.success) {
    const operation = OperationResultSchema.safeParse(rawResponse);
    throw new Error(
      operation.success ? operation.data.message || '无法生成成本预估' : '成本预估格式无效',
    );
  }
  return response.data;
}

function collectCandidates(): Array<TranslationBlock & { element: HTMLElement }> {
  return collectTranslationCandidates(document, {
    getId: getElementId,
    getText: getSourceText,
    siteRule: resolveSiteRule(window.location),
  });
}

/**
 * Re-reads the candidate set immediately before committing asynchronous work.
 * Text equality alone is insufficient: a page can add `hidden`, an
 * interactive role, or an excluded ancestor while a Provider/cache request is
 * in flight. Such a node must not receive the late response after the scan
 * has removed its previous translation.
 */
function getCurrentCandidatesByElement(): Map<HTMLElement, TranslationBlock & { element: HTMLElement }> {
  return new Map(collectCandidates().map((candidate) => [candidate.element, candidate]));
}

function isCurrentCandidateSnapshot(
  candidate: TranslationBlock & { element: HTMLElement },
  currentCandidatesByElement: ReadonlyMap<HTMLElement, TranslationBlock & { element: HTMLElement }>,
): boolean {
  const current = currentCandidatesByElement.get(candidate.element);
  return current?.id === candidate.id && current.text === candidate.text;
}

function compareCandidatePriority(
  left: TranslationBlock & { element: HTMLElement },
  right: TranslationBlock & { element: HTMLElement },
): number {
  const viewportHeight = window.innerHeight || 800;
  const leftRect = left.element.getBoundingClientRect();
  const rightRect = right.element.getBoundingClientRect();
  const leftVisible = leftRect.bottom > 0 && leftRect.top < viewportHeight;
  const rightVisible = rightRect.bottom > 0 && rightRect.top < viewportHeight;
  if (leftVisible !== rightVisible) return leftVisible ? -1 : 1;
  return leftRect.top - rightRect.top;
}

function getElementId(element: HTMLElement): string {
  const existingId = idsByElement.get(element);
  if (existingId) {
    return existingId;
  }

  const id = `textduet-${nextBlockId++}`;
  idsByElement.set(element, id);
  return id;
}

function getSourceText(element: HTMLElement): string {
  const text = readTextWithoutTranslations(element);
  const existingText = sourceTextByElement.get(element);
  if (existingText === undefined) {
    sourceTextByElement.set(element, text);
  } else if (existingText !== text) {
    // Keep the old snapshot until processLoadedContent calls clearCandidate;
    // that operation removes only our owned translation and then commits the
    // new snapshot atomically.
    sourceTextChangedInScan.add(element);
  }
  return text;
}

function clearCandidateForCurrentScan(element: HTMLElement, run: TranslationRun): void {
  const id = idsByElement.get(element);
  // Element IDs are intentionally stable across SPA rerenders, so a changed
  // text snapshot must also invalidate terminal failure/success bookkeeping.
  // Otherwise a provider failure for the previous route can permanently
  // suppress the replacement text on the same DOM node.
  if (id) {
    run.failedIds.delete(id);
    run.translatedIds.delete(id);
  }
  clearCandidate(element, sourceTextByElement);
}

function scheduleLifecycleRetry(run: TranslationRun): void {
  if (!isActiveRun(run.id) || run.retryTimer !== undefined) return;
  run.retryTimer = window.setTimeout(() => {
    run.retryTimer = undefined;
    if (isActiveRun(run.id)) scheduleScan(run, 0);
  }, 500);
}

function isActiveRun(runId: number): boolean {
  return activeRunId === runId && activeRun?.id === runId;
}

function isCurrentRunView(run: TranslationRun, viewGeneration: number): boolean {
  return isActiveRun(run.id)
    && isCurrentView(activeRunId, run.id, run.viewGeneration, viewGeneration);
}

/**
 * Construct a fresh, page-scoped memory. It deliberately has no Storage or
 * BroadcastChannel integration so the Translator remains a low-privilege
 * DOM-only context.
 */
function createRunMemory(): TranslationMemory | null {
  try {
    return new TranslationMemory();
  } catch {
    return null;
  }
}

async function translateSelection(text: string, sourceLanguage: string, targetLanguage: string, translationColor?: string): Promise<void> {
  const captured = getCapturedSelection();
  const selectedText = captured?.text || '';
  if (!selectedText || selectedText !== text.replace(/\s+/g, ' ').trim()) {
    renderSelectionError('选中文本已变化，请重新选择');
    return;
  }
  if (selectedText.length > 4_000) {
    renderSelectionError('选区过长');
    return;
  }
  const anchorElement = captured?.anchor;
  if (!anchorElement || anchorElement.closest('code,pre,form,input,textarea,select,button,[contenteditable]:not([contenteditable="false"]),[hidden],[aria-hidden="true"]')) {
    renderSelectionError('请选择正文段落中的文本');
    return;
  }
  const block = { id: `textduet-selection-${Date.now()}`, text: selectedText };
  const selectionRun = activeRun || createSelectionRun(targetLanguage);
  const requestViewGeneration = selectionRun.viewGeneration;
  const requestRun = activeRun;
  const requestAnchor = anchorElement;
  const requestText = selectedText;
  const requestSelectionRevision = captured?.revision ?? 0;
  const requestHref = window.location.href;
  try {
    const response = await streamBatch(
      { sourceLanguage, targetLanguage, forceRefresh: false, blocks: [block] },
      [],
      selectionRun,
    );
    if (!isCurrentSelectionRequest(requestRun, selectionRun, requestViewGeneration, requestAnchor, requestText, requestSelectionRevision, requestHref)) {
      return;
    }
    // Selection output is committed only after the complete, schema-validated
    // response arrives. This keeps a late stream error from leaving partial
    // content in the page.
    const translated = response.blocks[0];
    if (!translated) throw new Error('模型没有返回译文');
    renderSelectionTranslation(text, translated, targetLanguage, translationColor);
  } catch (error) {
    if (!isCurrentSelectionRequest(requestRun, selectionRun, requestViewGeneration, requestAnchor, requestText, requestSelectionRevision, requestHref)) {
      return;
    }
    renderSelectionError(normalizeSelectionError(error, t));
  }
}

function isCurrentSelectionRequest(
  requestRun: TranslationRun | null,
  selectionRun: TranslationRun,
  requestViewGeneration: number,
  anchor: HTMLElement,
  text: string,
  selectionRevision: number,
  href: string,
): boolean {
  const captured = getCapturedSelection();
  if (window.location.href !== href
    || !captured
    || captured.anchor !== anchor
    || captured.text !== text
    || captured.revision !== selectionRevision
    || !isConnectedElement(anchor)) {
    return false;
  }

  // Opening a context menu can clear the live Selection object. The captured
  // snapshot remains authoritative in that case, but a new non-empty live
  // selection must invalidate the in-flight request.
  const liveText = normalizeSelectionText(window.getSelection()?.toString() || '');
  if (liveText && liveText !== text) return false;

  if (requestRun === null) {
    // A synthetic selection run has no page lifecycle of its own. If a page
    // translation starts while it is in flight, its result belongs to the old
    // context and must be dropped.
    return activeRun === null && selectionRun.id === 0;
  }
  return activeRun === requestRun
    && isCurrentRunView(requestRun, requestViewGeneration);
}

function isConnectedElement(element: HTMLElement): boolean {
  const connected = (element as HTMLElement & { isConnected?: boolean }).isConnected;
  if (connected !== undefined) return connected;
  const documentElement = element.ownerDocument?.documentElement;
  return Boolean(documentElement?.contains(element));
}

function createSelectionRun(targetLanguage: string): TranslationRun {
  return {
    id: 0, viewGeneration: 0, sourceLanguage: 'auto', targetLanguage, displayMode: 'bilingual',
    translationColor: DEFAULT_TRANSLATION_COLOR, selectionQuickAction: false, headerPopupRescan: false, forceRefresh: false, observer: null,
    scanTimer: undefined, retryTimer: undefined, isProcessing: false, hasPendingScan: false,
    translatedIds: new Set(), failedIds: new Set(), seenIds: new Set(), failedBatchCount: 0,
    // Selection runs are short-lived and use the element directly; the
    // per-run memory would be torn down by the same lifecycle so we
    // skip it here.
    memory: null,
    modelHint: '',
    useHighlightStrategy: false,
  };
}

let selectionQuickActionButton: HTMLButtonElement | null = null;
let selectionQuickActionTimer: number | undefined;
let selectionQuickActionCleanup: (() => void) | null = null;
let selectionQuickActionText = '';
let selectionQuickActionHiddenUntil = 0;
let selectionQuickActionRetryCount = 0;

function installSelectionQuickAction(run: TranslationRun): void {
  removeSelectionQuickAction();
  if (!run.selectionQuickAction) return;
  const listener = () => {
    if (selectionQuickActionTimer !== undefined) window.clearTimeout(selectionQuickActionTimer);
    selectionQuickActionTimer = window.setTimeout(() => {
      selectionQuickActionRetryCount = 0;
      updateSelectionQuickAction(run);
    }, 60);
  };
  document.addEventListener('selectionchange', listener);
  document.addEventListener('pointerup', listener, true);
  document.addEventListener('mouseup', listener, true);
  document.addEventListener('touchend', listener, true);
  window.addEventListener('selectionchange', listener);
  window.addEventListener('focus', listener);
  document.addEventListener('visibilitychange', listener);
  selectionQuickActionCleanup = () => {
    document.removeEventListener('selectionchange', listener);
    document.removeEventListener('pointerup', listener, true);
    document.removeEventListener('mouseup', listener, true);
    document.removeEventListener('touchend', listener, true);
    window.removeEventListener('selectionchange', listener);
    window.removeEventListener('focus', listener);
    document.removeEventListener('visibilitychange', listener);
  };
  // The setting can be enabled after the user already selected text. Recheck
  // on the next frame instead of requiring another selection gesture.
  window.requestAnimationFrame(() => updateSelectionQuickAction(run));
}

function updateSelectionQuickAction(run: TranslationRun): void {
  if (run.id !== 0 && !isActiveRun(run.id)) return;
  if (performance.now() < selectionQuickActionHiddenUntil) return;
  const selection = window.getSelection();
  const text = normalizeSelectionText(selection?.toString() || '');
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const anchor = text && range ? captureSelectionAnchor() : null;
  if (!text || text.length > 4_000 || !range || !anchor || anchor.closest('code,pre,form,input,textarea,select,button,[contenteditable]:not([contenteditable=\"false\"]),[hidden],[aria-hidden=\"true\"]')) {
    hideSelectionQuickAction(false);
    return;
  }
  const rect = [...range.getClientRects()].at(-1) || range.getBoundingClientRect();
  if (!rect.width && !rect.height) {
    if (selectionQuickActionRetryCount < 3) {
      selectionQuickActionRetryCount += 1;
      window.setTimeout(() => updateSelectionQuickAction(run), 50);
    }
    return;
  }
  selectionQuickActionText = text;
  if (!selectionQuickActionButton) {
    selectionQuickActionButton = document.createElement('button');
    selectionQuickActionButton.type = 'button';
    selectionQuickActionButton.className = SELECTION_QUICK_ACTION_CLASS;
    selectionQuickActionButton.setAttribute('aria-label', '翻译选中文本');
    selectionQuickActionButton.title = '翻译选中文本';
    selectionQuickActionButton.textContent = '文A';
    selectionQuickActionButton.addEventListener('pointerdown', (event) => event.preventDefault());
    selectionQuickActionButton.addEventListener('click', () => {
      captureSelectionAnchor();
      const currentText = selectionQuickActionText;
      if (currentText) void browser.runtime.sendMessage({ type: 'REQUEST_SELECTION_TRANSLATION', text: currentText });
      hideSelectionQuickAction(true);
    });
    document.documentElement.append(selectionQuickActionButton);
  }
  // The injected stylesheet deliberately uses !important to survive arbitrary
  // site CSS, so the dynamic coordinates need the same priority.
  const placement = resolveSelectionQuickActionPosition(rect);
  selectionQuickActionButton.style.setProperty('left', `${placement.left}px`, 'important');
  selectionQuickActionButton.style.setProperty('top', `${placement.top}px`, 'important');
}

function resolveSelectionQuickActionPosition(rect: DOMRect): { left: number; top: number } {
  const buttonSize = 30;
  const gap = 10;
  const viewportPadding = 6;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const centeredTop = rect.top + Math.max(0, (rect.height - buttonSize) / 2);

  // Keep the control outside the selected range whenever there is horizontal
  // room, so it never obscures the text the user is reviewing.
  if (rect.right + gap + buttonSize <= viewportWidth - viewportPadding) {
    return { left: rect.right + gap, top: clamp(centeredTop, viewportPadding, viewportHeight - buttonSize - viewportPadding) };
  }
  if (rect.left - gap - buttonSize >= viewportPadding) {
    return { left: rect.left - gap - buttonSize, top: clamp(centeredTop, viewportPadding, viewportHeight - buttonSize - viewportPadding) };
  }
  if (rect.bottom + gap + buttonSize <= viewportHeight - viewportPadding) {
    return { left: clamp(rect.right - buttonSize, viewportPadding, viewportWidth - buttonSize - viewportPadding), top: rect.bottom + gap };
  }
  return {
    left: clamp(rect.right - buttonSize, viewportPadding, viewportWidth - buttonSize - viewportPadding),
    top: clamp(rect.top - gap - buttonSize, viewportPadding, viewportHeight - buttonSize - viewportPadding),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function removeSelectionQuickAction(): void {
  if (selectionQuickActionTimer !== undefined) window.clearTimeout(selectionQuickActionTimer);
  selectionQuickActionTimer = undefined;
  selectionQuickActionText = '';
  selectionQuickActionRetryCount = 0;
  selectionQuickActionHiddenUntil = 0;
  selectionQuickActionCleanup?.();
  selectionQuickActionCleanup = null;
  selectionQuickActionButton?.remove();
  selectionQuickActionButton = null;
}

function hideSelectionQuickAction(suppressUntilNextSelection = false): void {
  selectionQuickActionHiddenUntil = suppressUntilNextSelection
    ? performance.now() + 700
    : 0;
  if (selectionQuickActionTimer !== undefined) window.clearTimeout(selectionQuickActionTimer);
  selectionQuickActionTimer = undefined;
  selectionQuickActionButton?.remove();
  selectionQuickActionButton = null;
}

function normalizeSelectionText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseRuntimeMessageSafely(value: unknown): RuntimeMessage | null {
  try {
    return parseRuntimeMessage(value);
  } catch {
    return null;
  }
}

// ---- Header popup rescan ----
//
// Some sites (GitHub, Stack Overflow, etc.) render user-triggered
// popovers as portals mounted on <body> rather than as descendants of
// the site <header>. MutationObserver on document.documentElement does
// catch the new nodes, but the listener fires after the popover
// finishes opening, which can race with the existing debounced scan.
//
// When the user opts in via Options, we additionally listen for
// `pointerup` on the page header / [role="banner"] subtree and schedule
// a short-delay scan. This guarantees the popover content is in the
// DOM by the time the scan runs, without firing for every click in
// the document body.

const HEADER_POPUP_RESCAN_DELAY_MS = 300;
let headerPopupRescanCleanup: (() => void) | null = null;

// Leading-edge throttle for visibility-driven rescans. macOS fires
// visibilitychange on every window-occlusion / fullscreen toggle
// (switching apps, Mission Control, devtools focus), so without a
// throttle the user can trigger several scans inside a single tick.
// 250ms is short enough that the user still sees a scan complete in
// the same paint frame as the tab returning to the foreground, while
// long enough to coalesce the back-to-back visibility events the OS
// emits when the user briefly visits another app and returns.
const VISIBILITY_RESCAN_THROTTLE_MS = 250;

function installHeaderPopupRescan(run: TranslationRun): void {
  removeHeaderPopupRescan();
  const onPointerUp = (event: PointerEvent): void => {
    if (!isActiveRun(run.id)) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    // Match both the semantic <header> and the ARIA banner landmark.
    if (!target.closest('header, [role="banner"]')) return;
    scheduleScan(run, HEADER_POPUP_RESCAN_DELAY_MS);
  };
  // capture so we run before the popover's own click handler installs it
  document.addEventListener('pointerup', onPointerUp, true);
  headerPopupRescanCleanup = () => {
    document.removeEventListener('pointerup', onPointerUp, true);
  };
}

function removeHeaderPopupRescan(): void {
  if (headerPopupRescanCleanup) {
    headerPopupRescanCleanup();
    headerPopupRescanCleanup = null;
  }
}

// ---- SPA navigation reset ----
//
// When a hash-routed SPA (e.g. Next.js app router, Vue Router) navigates
// between views, the shared layout (top nav, sidebar, footer) is re-rendered
// into a new set of DOM nodes. Without intervention, the old translation
// spans from the previous route remain in the DOM as orphans, and the new
// layout gets fresh translations — yielding the visible "Home / API
// Documentation / ..." stack repeated vertically that users hit when they
// click a post and then go back.
//
// The fix: when a SPA route change fires, do a full cleanup of every
// .td-translation and unwrap every .td-source, then schedule a fresh
// scan. The next run rebuilds translations from scratch on the new view.
// Patching history.pushState / replaceState covers programmatic
// navigation (router.push); popstate covers back/forward.

let spaNavigationCleanup: (() => void) | null = null;

function installSpaNavigationReset(run: TranslationRun): void {
  removeSpaNavigationReset();
  if (typeof window === 'undefined') return;
  const onNavigate = (): void => {
    if (!isActiveRun(run.id)) return;
    run.viewGeneration = advanceViewGeneration(
      run.viewGeneration,
      run.failedIds,
      run.translatedIds,
    );
    // A response that is already in flight belongs to the old view. Closing
    // its ports both saves work and makes the stale-view boundary explicit;
    // the generation check below remains the correctness guard if a provider
    // resolves concurrently with this disconnect.
    activeStreamPorts.forEach((port) => {
      try { port.disconnect(); } catch { /* already disconnected */ }
    });
    activeStreamPorts.clear();
    // NOTE: deliberately NOT calling `run.observer?.abort()` here. The
    // observer's AbortController is shared by every future mutation
    // callback, so a single abort() permanently killed dynamic-content
    // observation for the rest of the run - infinite scroll / new
    // content on the post-navigation view never translated. The pending
    // debounced scan is idempotent and simply merges with the scan
    // scheduled below.
    // Drop every previous translation so the shared layout does not
    // accumulate duplicates across route changes.
    removeRenderedTranslations();
    // Re-scan on the next microtask so the SPA has time to mount
    // the new view before we read the DOM.
    scheduleScan(run, 0);
  };
  // Throttle the reset trigger so a flurry of events (view transition
  // + hashchange + visibilitychange + popstate in the same tick) does
  // not queue five consecutive cleanups. `removeRenderedTranslations`
  // is idempotent but a no-op 50 ms later means we re-render once,
  // not five times. 50 ms is short enough that a real user still
  // sees the new view translated in the same paint frame.
  const throttledOnNavigate = createLeadingThrottle(50, onNavigate);
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);
  history.pushState = (...args: Parameters<typeof history.pushState>): void => {
    originalPushState(...args);
    throttledOnNavigate();
  };
  history.replaceState = (...args: Parameters<typeof history.replaceState>): void => {
    originalReplaceState(...args);
    throttledOnNavigate();
  };
  const onPopState = (): void => throttledOnNavigate();
  const onHashChange = (): void => throttledOnNavigate();
  // Tab visibility: reconcile, never wipe. TD-2026-028: the previous
  // full reset (removeRenderedTranslations + re-scan) destroyed and
  // re-inserted every translation region each time the tab became
  // visible again - on macOS, switching between the browser and other
  // apps fires visibilitychange (window occlusion / fullscreen), so
  // users saw translation regions repeatedly re-inserted plus a flash
  // of the untranslated page. A scan alone reconciles: elements whose
  // translation is already rendered (same text, same target language)
  // are skipped by `processLoadedContent`; only genuinely new or
  // changed content gets translated.
  //
  // TD-2026-029: the same scan is now also throttled with a leading
  // edge so a flurry of visibility changes (window occlusion,
  // fullscreen toggles, devtools focus) inside the same tick collapse
  // into one scan. Without the throttle each visible→hidden→visible
  // cycle re-queued a scan; the queued scan still produced no
  // duplicates on its own, but it ran repeatedly enough that a SPA
  // that re-rendered on focus ended up with each translation region
  // re-inserted by a follow-up render pass.
  const throttledOnVisibilityChange = createLeadingThrottle(
    VISIBILITY_RESCAN_THROTTLE_MS,
    () => {
      if (isActiveRun(run.id)) {
        scheduleScan(run, DYNAMIC_CONTENT_SCAN_DELAY_MS);
      }
    },
  );
  const onVisibilityChange = (): void => {
    // Do the visibility predicate before the leading-edge throttle. Otherwise
    // a hidden event can consume the 250 ms window and suppress the visible
    // event immediately following it, leaving new background-loaded content
    // unscanned.
    if (document.visibilityState !== 'visible') return;
    throttledOnVisibilityChange();
  };
  const onPageHide = (): void => {
    if (!isActiveRun(run.id)) return;
    run.viewGeneration = advanceViewGeneration(
      run.viewGeneration,
      run.failedIds,
      run.translatedIds,
    );
    activeStreamPorts.forEach((port) => {
      try { port.disconnect(); } catch { /* already disconnected */ }
    });
    activeStreamPorts.clear();
  };
  const onPageShow = (): void => {
    if (!isActiveRun(run.id)) return;
    // A pageshow after bfcache can reuse the same DOM nodes. The next scan
    // refreshes source snapshots and retries any lifecycle-disconnected batch.
    run.hasPendingScan = true;
    scheduleScan(run, 0);
  };
  window.addEventListener('popstate', onPopState);
  window.addEventListener('hashchange', onHashChange);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);

  // View Transitions API (Chrome 111+, optional). The browser fires
  // `viewtransitionstart` when a programmatic `document.startViewTransition`
  // begins swapping the DOM; the call site (SPA framework) usually
  // pauses paint until the new view mounts, so resetting translations
  // at start gives us a clean slate before any new translation lands.
  // Older browsers (no `document.startViewTransition` support) never
  // fire this event; `addEventListener` on an unknown event name is
  // a safe no-op per the DOM spec, so the registration itself is
  // portable.
  const onViewTransitionStart = (): void => throttledOnNavigate();
  document.addEventListener('viewtransitionstart', onViewTransitionStart);

  // Astro's island router emits `astro:before-swap` immediately
  // before it replaces the document body. Listening for it lets us
  // wipe the old view's translations before the swap completes.
  const onAstroBeforeSwap = (): void => onNavigate();
  document.addEventListener('astro:before-swap', onAstroBeforeSwap);

  spaNavigationCleanup = () => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.removeEventListener('popstate', onPopState);
    window.removeEventListener('hashchange', onHashChange);
    document.removeEventListener('viewtransitionstart', onViewTransitionStart);
    document.removeEventListener('astro:before-swap', onAstroBeforeSwap);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
  };
}

function removeSpaNavigationReset(): void {
  if (spaNavigationCleanup) {
    spaNavigationCleanup();
    spaNavigationCleanup = null;
  }
}
