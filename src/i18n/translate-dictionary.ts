// Coordinates a user-locale dictionary translation: batches zh-CN
// source keys, dispatches them through an injected fetcher (the
// TRANSLATE_I18N_BATCH runtime message in production), merges results,
// and persists via user-locales.

import type { I18nBatchTranslationResult } from '@/src/core/contracts';
import {
  I18N_RESULT_KEY_MAX_LENGTH,
  I18N_RESULT_MAX_KEYS,
  I18N_RESULT_TOTAL_CHARS,
  I18N_RESULT_VALUE_MAX_LENGTH,
} from '@/src/core/schemas';
import type { MessageDict } from './types';
import { MESSAGES_ZH_CN } from './messages/zh-CN';
import { I18N_BATCH_SIZE, type LocaleTag } from './types';
import {
  setUserLocale,
  hasUserLocale,
} from './user-locales';

export type Fetcher = (
  targetTag: string,
  targetLocale: string,
  sourceBatch: Record<string, string>,
) => Promise<I18nBatchTranslationResult>;

export interface TranslateProgress {
  total: number;
  done: number;
  /** Best-effort human-readable message ("正在翻译到 Français… 30/234"). */
  message: string;
}

export interface TranslateUiToOptions {
  fetcher: Fetcher;
  /** Human-readable locale name (e.g. "Français", "日本語"). */
  displayName: string;
  /** Where the source string comes from. Defaults to MESSAGES_ZH_CN. */
  source?: MessageDict;
  /** Batch size override. Defaults to I18N_BATCH_SIZE (30). */
  batchSize?: number;
  /** Progress callback (called once per batch). */
  onProgress?: (progress: TranslateProgress) => void;
  /** Abort signal. */
  signal?: AbortSignal;
}

export type TranslateUiToResult =
  | { ok: true; sourceModel: string; entryCount: number }
  | { ok: false; errorMessage: string };

/**
 * Translate the built-in zh-CN dictionary into `targetTag`. Updates
 * the in-memory + persistent user locale on success; returns the
 * provider's model name so the caller can record audit metadata.
 */
export async function translateUiTo(
  targetTag: LocaleTag,
  options: TranslateUiToOptions,
): Promise<TranslateUiToResult> {
  if (targetTag === 'zh-CN' || targetTag === 'en') {
    return { ok: false, errorMessage: '内置语言不需要翻译' };
  }
  if (hasUserLocale(targetTag)) {
    return { ok: true, sourceModel: 'cache', entryCount: -1 };
  }
  const source = options.source ?? MESSAGES_ZH_CN;
  const keys = Object.keys(source);
  const requestedBatchSize = options.batchSize ?? I18N_BATCH_SIZE;
  if (
    !Number.isSafeInteger(requestedBatchSize)
    || requestedBatchSize < 1
    || requestedBatchSize > I18N_RESULT_MAX_KEYS
  ) {
    return { ok: false, errorMessage: '批次大小无效' };
  }
  const batchSize = requestedBatchSize;
  const merged: MessageDict = Object.create(null) as MessageDict;
  let sourceModel = 'unknown';
  let totalBatches = 0;

  for (let i = 0; i < keys.length; i += batchSize) {
    if (options.signal?.aborted) {
      return { ok: false, errorMessage: '已取消' };
    }
    const slice = keys.slice(i, i + batchSize);
    const batch: Record<string, string> = Object.create(null) as Record<string, string>;
    for (const key of slice) {
      const value = source[key];
      if (typeof value === 'string') batch[key] = value;
    }
    options.onProgress?.({
      total: keys.length,
      done: Object.keys(merged).length,
      message: `正在翻译到 ${options.displayName}… ${Object.keys(merged).length}/${keys.length}`,
    });
    const result = await options.fetcher(targetTag, options.displayName, batch);
    if (!result.ok) {
      return { ok: false, errorMessage: result.errorMessage || '翻译失败' };
    }
    if (result.model) sourceModel = result.model;
    const translations = result.translations || {};
    const requestedKeys = new Set(slice);
    let resultChars = 0;
    for (const [key, value] of Object.entries(translations)) {
      if (
        !requestedKeys.has(key)
        || key.length === 0
        || key.length > I18N_RESULT_KEY_MAX_LENGTH
        || key === '__proto__'
        || key === 'constructor'
        || key === 'prototype'
        || typeof value !== 'string'
        || value.length === 0
        || value.length > I18N_RESULT_VALUE_MAX_LENGTH
      ) continue;
      const entryChars = key.length + value.length;
      if (resultChars + entryChars > I18N_RESULT_TOTAL_CHARS) break;
      merged[key] = value;
      resultChars += entryChars;
    }
    totalBatches += 1;
  }

  // Fill any keys the model skipped from the source (zh-CN fallback at
  // lookup time handles them, but we record the count honestly).
  for (const key of keys) {
    if (!Object.hasOwn(merged, key)) {
      const fallback = source[key];
      if (typeof fallback === 'string') merged[key] = fallback;
    }
  }
  options.onProgress?.({
    total: keys.length,
    done: keys.length,
    message: `已翻译到 ${options.displayName}`,
  });
  await setUserLocale(targetTag, merged, sourceModel);
  return { ok: true, sourceModel, entryCount: Object.keys(merged).length };
}
