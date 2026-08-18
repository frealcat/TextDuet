import type {
  RuntimeMessage,
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

const INSTALL_MARKER = '__textDuetInstalled';
type TranslatorGlobal = typeof globalThis & {
  [INSTALL_MARKER]?: boolean;
};

let activeRunId = 0;
let nextBlockId = 0;
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
  targetLanguage: string;
  displayMode: TranslationDisplayMode;
  translationColor: string;
  forceRefresh: boolean;
  observer: MutationObserver | null;
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

  injectPageStyles();
  browser.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
    const parsedMessage = parseRuntimeMessageSafely(rawMessage);
    if (!parsedMessage) {
      return false;
    }

    if (parsedMessage.type === 'START_PAGE_TRANSLATION') {
      startTranslationRun(
        parsedMessage.targetLanguage,
        parsedMessage.displayMode ?? 'bilingual',
        parsedMessage.translationColor ?? DEFAULT_TRANSLATION_COLOR,
        parsedMessage.forceRefresh ?? true,
      );
      sendResponse({ ok: true, message: '已开始翻译当前网页' });
      return false;
    }

    if (parsedMessage.type === 'STOP_PAGE_TRANSLATION') {
      stopActiveRun();
      updatePageStatus('已停止翻译，原文和已完成译文保持不变', 'stopped');
      sendResponse({ ok: true, message: '已停止翻译' });
      return false;
    }

    if (parsedMessage.type === 'SET_PAGE_DISPLAY_MODE') {
      setTranslationDisplayMode(parsedMessage.displayMode);
      if (activeRun) activeRun.displayMode = parsedMessage.displayMode;
      sendResponse({ ok: true, message: '显示模式已切换' });
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
  targetLanguage: string,
  displayMode: TranslationDisplayMode,
  translationColor: string,
  forceRefresh: boolean,
): void {
  stopActiveRun();
  removeRenderedTranslations();
  setTranslationDisplayMode(displayMode);
  setTranslationColor(translationColor);
  updatePageStatus('正在检查当前已加载内容…', 'progress');
  const runId = ++activeRunId;
  const run: TranslationRun = {
    id: runId,
    targetLanguage,
    displayMode,
    translationColor,
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
  run.observer = observeDynamicContent(sourceTextByElement, () => {
    if (isActiveRun(run.id)) scheduleScan(run, DYNAMIC_CONTENT_SCAN_DELAY_MS);
  });
  scheduleScan(run, 0);
}

function stopActiveRun(): void {
  activeRunId += 1;
  if (!activeRun) return;
  lastRunSnapshot = {
    candidateCount: activeRun.seenIds.size,
    translatedCount: activeRun.translatedIds.size,
    failedBatchCount: activeRun.failedBatchCount,
  };
  activeRun.observer?.disconnect();
  if (activeRun.scanTimer !== undefined) window.clearTimeout(activeRun.scanTimer);
  activeRun = null;
}

function scheduleScan(run: TranslationRun, delayMs: number): void {
  if (!isActiveRun(run.id)) return;
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
          updatePageStatus('当前已加载区域没有找到可翻译正文，继续等待新内容', 'empty');
        } else {
          updatePageStatus(
            `当前已加载内容已翻译，共 ${run.translatedIds.size} 段；继续监听滚动加载的新内容`,
            'complete',
          );
        }
        continue;
      }

      try {
        await translateCandidates(candidates, run);
      } catch (error) {
        run.failedBatchCount += 1;
        candidates.forEach(({ id }) => run.failedIds.add(id));
        if (isActiveRun(run.id)) {
          updatePageStatus(error instanceof Error ? error.message : '网页翻译失败', 'error');
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

  const estimates = await Promise.all(
    batches.map((blocks) => requestTranslationEstimate(blocks, targetLanguage, run.forceRefresh)),
  );
  const estimate = summarizePageEstimates(estimates, candidates.length);
  const { currency, isPriceConfigured, message: estimateMessage } = estimate;
  updatePageStatus(estimateMessage, 'progress');
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  let recordedAmount = 0;
  let latestTodayAmount = estimate.todayTotalCost;
  let latestThreshold: 50 | 80 | 100 | undefined;
  const usageRecordingStatuses: UsageRecordingStatus[] = [];
  let cacheHitCount = 0;
  let isCacheAvailable = estimate.isCacheAvailable;

  for (const [batchIndex, blocks] of batches.entries()) {
    if (!isActiveRun(run.id)) {
      return;
    }

    updatePageStatus(
      `正在翻译第 ${batchIndex + 1}/${batches.length} 批（共 ${candidates.length} 段）；${estimateMessage}`,
      'progress',
    );

    const rawResponse: unknown = await browser.runtime.sendMessage({
      type: 'TRANSLATE_BATCH',
      request: {
        sourceLanguage: 'auto',
        targetLanguage,
        forceRefresh: run.forceRefresh,
        blocks,
      },
    } satisfies RuntimeMessage);

    const response = TranslationBatchResponseSchema.safeParse(rawResponse);
    if (!response.success) {
      const operation = OperationResultSchema.safeParse(rawResponse);
      throw new Error(
        operation.success ? operation.data.message || '网页翻译失败' : '扩展返回的译文格式无效',
      );
    }

    if (!isActiveRun(run.id)) {
      return;
    }

    recordedAmount += response.data.cost.amount;
    latestTodayAmount = response.data.cost.today.totalCost;
    latestThreshold = response.data.cost.crossedThresholds.at(-1) || latestThreshold;
    usageRecordingStatuses.push({
      usageKind: response.data.usage.kind,
      isLedgerRecorded: response.data.cost.isLedgerRecorded,
    });
    cacheHitCount += response.data.cache.hitCount;
    isCacheAvailable &&= response.data.cache.isAvailable;
    renderTranslations(styledCandidates, response.data.blocks, targetLanguage);
    response.data.blocks.forEach(({ id }) => run.translatedIds.add(id));
  }

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

async function requestTranslationEstimate(
  blocks: TranslationBlock[],
  targetLanguage: string,
  forceRefresh: boolean,
) {
  const rawResponse: unknown = await browser.runtime.sendMessage({
    type: 'ESTIMATE_TRANSLATION',
    request: { sourceLanguage: 'auto', targetLanguage, forceRefresh, blocks },
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

function parseRuntimeMessageSafely(value: unknown): RuntimeMessage | null {
  try {
    return parseRuntimeMessage(value);
  } catch {
    return null;
  }
}
