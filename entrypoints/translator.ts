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
  setTranslationColor,
  setTranslationDisplayMode,
  TRANSLATION_CLASS,
  updatePageStatus,
} from '@/src/translator/page-status';
import {
  describeUsageRecording,
  summarizePageEstimates,
  type UsageRecordingStatus,
} from '@/src/translator/estimate-status';
import { collectTranslationCandidates } from '@/src/translator/dom-extraction';
import {
  DYNAMIC_CONTENT_SCAN_DELAY_MS,
  observeDynamicContent,
} from '@/src/translator/dynamic-content';
import {
  removeRenderedTranslations,
  renderTranslations,
} from '@/src/translator/render-translations';
import { resolveSiteRule } from '@/src/translator/site-rules';
import { collectStyleContext } from '@/src/translator/style-context';
import { captureSelectionAnchor, getCapturedSelection, renderSelectionError, renderSelectionTranslation } from '@/src/translator/selection-translation';
import { applyLocale, type LanguagePreference, resolveActiveLocale, t } from '@/src/i18n';

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
let lastRunSnapshot: {
  candidateCount: number;
  translatedCount: number;
  failedBatchCount: number;
} | null = null;

interface TranslationRun {
  id: number;
  sourceLanguage: string;
  targetLanguage: string;
  displayMode: TranslationDisplayMode;
  translationColor: string;
  selectionQuickAction: boolean;
  headerPopupRescan: boolean;
  forceRefresh: boolean;
  observer: import('@/src/translator/dynamic-content').DynamicContentHandle | null;
  scanTimer: number | undefined;
  isProcessing: boolean;
  hasPendingScan: boolean;
  translatedIds: Set<string>;
  failedIds: Set<string>;
  seenIds: Set<string>;
  failedBatchCount: number;
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
      sendResponse({ ok: true, message: t('translator.message.started') });
      return false;
    }

    if (parsedMessage.type === 'TRANSLATE_SELECTION') {
      captureSelectionAnchor();
      void translateSelection(parsedMessage.text, parsedMessage.sourceLanguage, parsedMessage.targetLanguage, parsedMessage.translationColor);
      sendResponse({ ok: true, message: t('translator.message.selectionStarted') });
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
  removeRenderedTranslations();
  setTranslationDisplayMode(displayMode);
  setTranslationColor(translationColor);
  updatePageStatus(t('translator.status.checking'), 'progress');
  const runId = ++activeRunId;
  const run: TranslationRun = {
    id: runId,
    sourceLanguage,
    targetLanguage,
    displayMode,
    translationColor,
    selectionQuickAction,
    headerPopupRescan,
    forceRefresh,
    observer: null,
    scanTimer: undefined,
    isProcessing: false,
    hasPendingScan: false,
    translatedIds: new Set(),
    failedIds: new Set(),
    seenIds: new Set(),
    failedBatchCount: 0,
  };
  activeRun = run;
  installSelectionQuickAction(run);
  if (headerPopupRescan) installHeaderPopupRescan(run);
  run.observer = observeDynamicContent(sourceTextByElement, () => {
    if (isActiveRun(run.id)) scheduleScan(run, DYNAMIC_CONTENT_SCAN_DELAY_MS);
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
      const loadedCandidates = collectCandidates();
      loadedCandidates.forEach(({ id }) => run.seenIds.add(id));
      for (const { id, element } of loadedCandidates) {
        const existing = element.querySelector<HTMLElement>(`:scope > .${TRANSLATION_CLASS}`);
        if (existing?.lang === run.targetLanguage) run.translatedIds.add(id);
      }
      const candidates = loadedCandidates.filter(({ id, element }) => {
        if (run.failedIds.has(id)) return false;
        const existing = element.querySelector<HTMLElement>(`:scope > .${TRANSLATION_CLASS}`);
        return !existing || existing.lang !== run.targetLanguage;
      });

      if (candidates.length === 0) {
        if (run.translatedIds.size === 0) {
          updatePageStatus(t('translator.status.empty'), 'empty');
        } else {
          updatePageStatus(
            `当前已加载内容已翻译，共 ${run.translatedIds.size} 段；继续监听滚动加载的新内容`,
            'complete',
          );
        }
        continue;
      }

      candidates.sort(compareCandidatePriority);
      try {
        await translateCandidates(candidates, run);
      } catch (error) {
        run.failedBatchCount += 1;
        candidates.forEach(({ id }) => run.failedIds.add(id));
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
  updatePageStatus(t('translator.status.preparing'), 'progress');

  let recordedAmount = 0;
  let latestTodayAmount = initialEstimate.todayTotalCost;
  let latestThreshold: 50 | 80 | 100 | undefined;
  const usageRecordingStatuses: UsageRecordingStatus[] = [];
  let cacheHitCount = 0;
  let isCacheAvailable = initialEstimate.isCacheAvailable;

  for (const [batchIndex, blocks] of batches.entries()) {
    if (!isActiveRun(run.id)) {
      return;
    }

    updatePageStatus(`正在翻译第 ${batchIndex + 1}/${batches.length} 批（共 ${candidates.length} 段）…`, 'progress');

    const response = await streamBatch({ sourceLanguage: run.sourceLanguage, targetLanguage, forceRefresh: run.forceRefresh, blocks }, styledCandidates, run);

    if (!isActiveRun(run.id)) {
      return;
    }
    // Reconcile the complete batch after the stream closes. This is idempotent
    // and covers providers that emit a validated envelope only at completion.
    renderTranslations(styledCandidates, response.blocks, run.targetLanguage);

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
}

async function streamBatch(
  request: { sourceLanguage: string; targetLanguage: string; forceRefresh: boolean; blocks: TranslationBlock[] },
  styledCandidates: Array<TranslationBlock & { element: HTMLElement }>,
  run: TranslationRun,
  onBlock?: (block: import('@/src/core/contracts').TranslatedBlock) => void,
): Promise<TranslationBatchResponse> {
  const port = browser.runtime.connect({ name: 'textduet-translation-stream' });
  activeStreamPorts.add(port);
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
          run.translatedIds.add(event.block.id);
          if (onBlock) onBlock(event.block);
          else renderTranslations(styledCandidates, [event.block], run.targetLanguage);
          return;
        }
        if (event.type === 'TRANSLATION_COMPLETE') {
          // Some compatible endpoints buffer the JSON envelope until the
          // final SSE event. Render any blocks not emitted incrementally so a
          // completed batch can never finish with an empty page region.
          if (!onBlock) {
            renderTranslations(styledCandidates, event.response.blocks, run.targetLanguage);
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
      if (!settled) { settled = true; reject(new Error('流式翻译连接已断开')); }
    });
    port.postMessage({ type: 'TRANSLATE_BATCH_STREAM', request });
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
  const existingText = sourceTextByElement.get(element);
  if (existingText !== undefined) {
    return existingText;
  }

  const text = element.innerText;
  sourceTextByElement.set(element, text);
  return text;
}

function isActiveRun(runId: number): boolean {
  return activeRunId === runId && activeRun?.id === runId;
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
  try {
    const response = await streamBatch(
      { sourceLanguage, targetLanguage, forceRefresh: false, blocks: [block] },
      [],
      activeRun || createSelectionRun(targetLanguage),
      (blockResult) => renderSelectionTranslation(text, blockResult, targetLanguage, translationColor),
    );
    if (!response.blocks[0]) throw new Error('模型没有返回译文');
  } catch (error) {
    renderSelectionError(normalizeSelectionError(error));
  }
}

function createSelectionRun(targetLanguage: string): TranslationRun {
  return {
    id: 0, sourceLanguage: 'auto', targetLanguage, displayMode: 'bilingual',
    translationColor: DEFAULT_TRANSLATION_COLOR, selectionQuickAction: false, headerPopupRescan: false, forceRefresh: false, observer: null,
    scanTimer: undefined, isProcessing: false, hasPendingScan: false,
    translatedIds: new Set(), failedIds: new Set(), seenIds: new Set(), failedBatchCount: 0,
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
    selectionQuickActionButton.className = 'textduet-selection-quick-action';
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

function normalizeSelectionError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/api key|密钥|认证/i.test(message)) return '请先配置 API Key';
  if (/过长|4000|长度/i.test(message)) return '选区过长';
  if (/格式|json|段落/i.test(message)) return '模型返回格式无效';
  if (/余额|限流|不可用/i.test(message)) return message.slice(0, 80);
  return '选区翻译失败';
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
    // Cancel any in-flight `scheduler.postTask` triggered by the
    // observer (Layer 4) so the heavy work from the old view does
    // not race the new scan.
    run.observer?.abort();
    // Drop every previous translation so the shared layout does not
    // accumulate duplicates across route changes.
    removeRenderedTranslations();
    // Re-scan on the next microtask so the SPA has time to mount
    // the new view before we read the DOM.
    scheduleScan(run, 0);
  };
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);
  history.pushState = (...args: Parameters<typeof history.pushState>): void => {
    originalPushState(...args);
    onNavigate();
  };
  history.replaceState = (...args: Parameters<typeof history.replaceState>): void => {
    originalReplaceState(...args);
    onNavigate();
  };
  const onPopState = (): void => onNavigate();
  const onHashChange = (): void => onNavigate();
  window.addEventListener('popstate', onPopState);
  window.addEventListener('hashchange', onHashChange);

  // View Transitions API (Chrome 111+, optional). The browser fires
  // `viewtransitionstart` when a programmatic `document.startViewTransition`
  // begins swapping the DOM; the call site (SPA framework) usually
  // pauses paint until the new view mounts, so resetting translations
  // at start gives us a clean slate before any new translation lands.
  const onViewTransitionStart = (): void => onNavigate();
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
  };
}

function removeSpaNavigationReset(): void {
  if (spaNavigationCleanup) {
    spaNavigationCleanup();
    spaNavigationCleanup = null;
  }
}
