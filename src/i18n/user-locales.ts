// User-translated UI dictionaries: storage layer for non-built-in locales.
//
// When the user picks a language we don't ship (e.g. ja-JP, fr-FR, de-DE),
// the Options page kicks off a one-shot translation request against the
// configured Provider. The result lands in `storage.local` under
// `textduet-user-locale-{tag}-{promptVersion}.json` and is loaded into an
// in-memory cache here on demand.

import type { LocaleTag, MessageDict } from './types';
import { I18N_PROMPT_VERSION, userLocaleStorageKey } from './types';
import { setLocaleOnly } from './locale-store';
import {
  I18N_RESULT_KEY_MAX_LENGTH,
  I18N_RESULT_VALUE_MAX_LENGTH,
  MODEL_NAME_MAX_LENGTH,
} from '@/src/core/schemas';
import { createOperationQueue } from '@/src/storage/operation-queue';

const USER_LOCALE_MAX_KEYS = 512;
const USER_LOCALE_TOTAL_CHARS = 1_000_000;
const USER_LOCALE_TAG_MAX_LENGTH = 64;
const USER_LOCALE_INDEX_MAX_TAGS = 128;
const USER_LOCALE_DATE_MAX_MS = 8_640_000_000_000_000;
const CONTROL_CHARACTER_PATTERN = /[\p{Cc}]/u;
const USER_LOCALE_INDEX_KEY = '__textduet_user_locale_index__';

export interface UserLocaleRecord {
  tag: string;
  promptVersion: string;
  /** Model identifier that produced this dictionary (audit / retranslate). */
  sourceModel: string;
  /** Epoch ms; used for "translated at" UI. */
  translatedAt: number;
  /** Number of keys in the dictionary. */
  entryCount: number;
  /** The actual translations. */
  messages: MessageDict;
}

/** In-memory cache keyed by locale tag. */
const memory: Map<string, UserLocaleRecord> = new Map();
/** Serialize index read-modify-write operations across locale mutations. */
const mutationQueue = createOperationQueue();

/** Browser storage shim; injected for tests via setStorageBackend. */
type StorageBackend = {
  getItem(key: string): Promise<unknown>;
  setItem(key: string, value: unknown): Promise<void>;
  removeItem(key: string): Promise<void>;
};

let backend: StorageBackend | null = null;

export function setStorageBackend(custom: StorageBackend | null): void {
  backend = custom;
}

function defaultBackend(): StorageBackend {
  if (backend) return backend;
  return {
    async getItem(key) {
      const result = await browser.storage.local.get(key);
      return result[key];
    },
    async setItem(key, value) {
      await browser.storage.local.set({ [key]: value });
    },
    async removeItem(key) {
      await browser.storage.local.remove(key);
    },
  };
}

function isRecord(value: unknown, expectedTag?: string): value is UserLocaleRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const requiredFields = ['tag', 'promptVersion', 'sourceModel', 'translatedAt', 'entryCount', 'messages'] as const;
  if (!requiredFields.every((field) => Object.hasOwn(v, field))) return false;
  return typeof v.tag === 'string'
    && isUserLocaleTag(v.tag)
    && (!expectedTag || v.tag === expectedTag)
    && v.promptVersion === I18N_PROMPT_VERSION
    && typeof v.sourceModel === 'string'
    && v.sourceModel.length <= MODEL_NAME_MAX_LENGTH
    && !CONTROL_CHARACTER_PATTERN.test(v.sourceModel)
    && typeof v.translatedAt === 'number'
    && Number.isSafeInteger(v.translatedAt)
    && v.translatedAt >= 0
    && v.translatedAt <= USER_LOCALE_DATE_MAX_MS
    && typeof v.entryCount === 'number'
    && Number.isSafeInteger(v.entryCount)
    && v.entryCount >= 0
    && v.entryCount <= USER_LOCALE_MAX_KEYS
    && v.messages !== null
    && typeof v.messages === 'object';
}

function isSafeLocaleTag(value: string): boolean {
  // Keep storage keys predictable and reject control characters, separators,
  // and unbounded strings from a tampered index or runtime response.
  return value.length >= 2
    && value.length <= USER_LOCALE_TAG_MAX_LENGTH
    && /^[A-Za-z0-9][A-Za-z0-9-]*$/.test(value);
}

function isUserLocaleTag(value: string): boolean {
  return isSafeLocaleTag(value) && value !== 'zh-CN' && value !== 'en';
}

/**
 * Normalize the persisted index before using it for storage reads. Slice the
 * untrusted array first so a corrupted index cannot force an unbounded scan;
 * deduplication also prevents duplicate records in the Options list.
 */
function normalizeIndexTags(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const index = value as Record<string, unknown>;
  if (!Object.hasOwn(index, 'tags') || !Array.isArray(index.tags)) return [];
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const candidate of index.tags.slice(0, USER_LOCALE_INDEX_MAX_TAGS)) {
    if (typeof candidate !== 'string' || !isUserLocaleTag(candidate) || seen.has(candidate)) continue;
    seen.add(candidate);
    tags.push(candidate);
  }
  return tags;
}

function normalizeSourceModel(value: string): string {
  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    throw new Error('模型名称包含控制字符');
  }
  const normalized = value.trim();
  if (normalized.length > MODEL_NAME_MAX_LENGTH) {
    throw new Error('模型名称过长');
  }
  return normalized || 'unknown';
}

function normalizeMessageDictionary(value: unknown): MessageDict {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('自定义语言译文格式无效');
  }
  const source = value as Record<string, unknown>;
  const keys = Object.keys(source);
  if (keys.length > USER_LOCALE_MAX_KEYS) throw new Error('自定义语言译文条目过多');
  const result: MessageDict = Object.create(null) as MessageDict;
  let totalChars = 0;
  for (const key of keys) {
    if (
      key.length === 0
      || key.length > I18N_RESULT_KEY_MAX_LENGTH
      || key === '__proto__'
      || key === 'constructor'
      || key === 'prototype'
    ) {
      throw new Error('自定义语言译文包含非法键');
    }
    const message = source[key];
    if (typeof message !== 'string' || message.length > I18N_RESULT_VALUE_MAX_LENGTH) {
      throw new Error('自定义语言译文长度无效');
    }
    totalChars += key.length + message.length;
    if (totalChars > USER_LOCALE_TOTAL_CHARS) throw new Error('自定义语言译文总量过大');
    result[key] = message;
  }
  return result;
}

/**
 * Restore a storage value after a failed multi-key update. User locale
 * records never intentionally use `undefined`, so an absent previous value
 * is represented by removing the key.
 */
async function restoreStorageValue(
  storage: StorageBackend,
  key: string,
  previous: unknown,
): Promise<void> {
  try {
    if (previous === undefined) {
      await storage.removeItem(key);
    } else {
      await storage.setItem(key, previous);
    }
  } catch {
    // Preserve the original write failure. The in-memory cache remains at its
    // prior value, and a subsequent load will validate whatever persisted.
  }
}

export function getUserLocale(tag: string): MessageDict | undefined {
  return memory.get(tag)?.messages;
}

export function hasUserLocale(tag: string): boolean {
  return memory.has(tag);
}

export function listUserLocales(): UserLocaleRecord[] {
  return [...memory.values()].sort((a, b) => b.translatedAt - a.translatedAt);
}

export async function setUserLocale(
  tag: string,
  messages: MessageDict,
  sourceModel: string,
  now: number = Date.now(),
): Promise<UserLocaleRecord> {
  return mutationQueue(() => setUserLocaleInternal(tag, messages, sourceModel, now));
}

async function setUserLocaleInternal(
  tag: string,
  messages: MessageDict,
  sourceModel: string,
  now: number,
): Promise<UserLocaleRecord> {
  if (!isSafeLocaleTag(tag)) {
    throw new Error('自定义语言标签无效');
  }
  if (tag === 'zh-CN' || tag === 'en') {
    throw new Error(`setUserLocale: '${tag}' is a built-in locale`);
  }
  if (!Number.isSafeInteger(now) || now < 0 || now > USER_LOCALE_DATE_MAX_MS) {
    throw new Error('自定义语言译文时间戳无效');
  }
  const safeMessages = normalizeMessageDictionary(messages);
  const safeSourceModel = normalizeSourceModel(sourceModel);
  const entryCount = Object.keys(safeMessages).length;
  const record: UserLocaleRecord = {
    tag,
    promptVersion: I18N_PROMPT_VERSION,
    sourceModel: safeSourceModel,
    translatedAt: now,
    entryCount,
    messages: safeMessages,
  };
  const backend = defaultBackend();
  const recordKey = userLocaleStorageKey(tag, I18N_PROMPT_VERSION);
  // Maintain a small index so loadAllUserLocales doesn't need full
  // `get(null)` capability (which the injected test backend doesn't
  // provide).
  const existing = await backend.getItem(USER_LOCALE_INDEX_KEY);
  const previousRecord = await backend.getItem(recordKey);
  const tags = normalizeIndexTags(existing).filter((entry) => entry !== tag);
  tags.push(tag);
  if (tags.length > USER_LOCALE_INDEX_MAX_TAGS) {
    tags.splice(0, tags.length - USER_LOCALE_INDEX_MAX_TAGS);
  }
  const nextIndex = { tags };
  try {
    await backend.setItem(recordKey, record);
    await backend.setItem(USER_LOCALE_INDEX_KEY, nextIndex);
  } catch (error) {
    // A locale is only visible after both writes succeed. Restore both keys
    // when a backend fails after partially applying the update.
    await restoreStorageValue(backend, recordKey, previousRecord);
    await restoreStorageValue(backend, USER_LOCALE_INDEX_KEY, existing);
    throw error;
  }
  memory.set(tag, record);
  setLocaleOnly(tag as LocaleTag);
  return record;
}

export async function clearUserLocale(tag: string): Promise<boolean> {
  return mutationQueue(() => clearUserLocaleInternal(tag));
}

async function clearUserLocaleInternal(tag: string): Promise<boolean> {
  if (!isUserLocaleTag(tag)) return false;
  const had = memory.has(tag);
  const backend = defaultBackend();
  const recordKey = userLocaleStorageKey(tag, I18N_PROMPT_VERSION);
  const previousRecord = await backend.getItem(recordKey);
  // Drop the tag from the index.
  const existing = await backend.getItem(USER_LOCALE_INDEX_KEY);
  const shouldWriteIndex = Boolean(existing && typeof existing === 'object' && !Array.isArray(existing));
  const nextTags = shouldWriteIndex
    ? normalizeIndexTags(existing).filter((t) => t !== tag)
    : [];
  try {
    await backend.removeItem(recordKey);
    if (shouldWriteIndex) {
      await backend.setItem(USER_LOCALE_INDEX_KEY, { tags: nextTags });
    }
  } catch (error) {
    await restoreStorageValue(backend, recordKey, previousRecord);
    await restoreStorageValue(backend, USER_LOCALE_INDEX_KEY, existing);
    throw error;
  }
  memory.delete(tag);
  return had;
}

export async function clearAllUserLocales(): Promise<number> {
  return mutationQueue(clearAllUserLocalesInternal);
}

async function clearAllUserLocalesInternal(): Promise<number> {
  const backend = defaultBackend();
  // A fresh Options page can have an empty memory cache while persisted
  // dictionaries are still indexed. Include both sources so "clear all"
  // removes records even before the catalog has been loaded.
  const previousIndex = await backend.getItem(USER_LOCALE_INDEX_KEY);
  const indexedTags = normalizeIndexTags(previousIndex);
  const tags = [...new Set([
    ...[...memory.keys()].filter(isUserLocaleTag),
    ...indexedTags,
  ])];
  const previousRecords = new Map<string, unknown>();
  await Promise.all(tags.map(async (tag) => {
    const key = userLocaleStorageKey(tag, I18N_PROMPT_VERSION);
    previousRecords.set(key, await backend.getItem(key));
  }));

  // Wait for every deletion before restoring/releasing the mutation queue.
  // Promise.all would reject on the first failure while slower removals were
  // still in flight, allowing a following set operation to race those stale
  // deletes.
  const removalResults = await Promise.allSettled(
    tags.map((tag) => backend.removeItem(userLocaleStorageKey(tag, I18N_PROMPT_VERSION))),
  );
  const removalFailure = removalResults.find((result) => result.status === 'rejected');
  if (removalFailure) {
    await Promise.allSettled([
      ...[...previousRecords.entries()].map(([key, previous]) =>
        restoreStorageValue(backend, key, previous),
      ),
      restoreStorageValue(backend, USER_LOCALE_INDEX_KEY, previousIndex),
    ]);
    throw removalFailure.reason;
  }

  try {
    await backend.removeItem(USER_LOCALE_INDEX_KEY);
  } catch (error) {
    // An index failure may happen after the records were removed. Restore the
    // complete snapshot so a retry or a concurrent Options view cannot observe
    // a half-cleared catalog.
    await Promise.allSettled([
      ...[...previousRecords.entries()].map(([key, previous]) =>
        restoreStorageValue(backend, key, previous),
      ),
      restoreStorageValue(backend, USER_LOCALE_INDEX_KEY, previousIndex),
    ]);
    throw error;
  }
  memory.clear();
  return tags.length;
}

export async function loadAllUserLocales(): Promise<UserLocaleRecord[]> {
  return mutationQueue(loadAllUserLocalesInternal);
}

async function loadAllUserLocalesInternal(): Promise<UserLocaleRecord[]> {
  // We use a sentinel prefix pattern rather than `get(null)` so the
  // injected test backend works without needing a full `get(null)`
  // capability.
  const storage = defaultBackend();
  const all = await storage.getItem(USER_LOCALE_INDEX_KEY);
  const loaded: UserLocaleRecord[] = [];
  const tags = normalizeIndexTags(all);
  for (const tag of tags) {
    const value = await storage.getItem(userLocaleStorageKey(tag, I18N_PROMPT_VERSION));
    if (!isRecord(value, tag)) continue;
    try {
      const messages = normalizeMessageDictionary(value.messages);
      if (value.entryCount !== Object.keys(messages).length) continue;
      const safeRecord: UserLocaleRecord = {
        tag: value.tag,
        promptVersion: I18N_PROMPT_VERSION,
        sourceModel: normalizeSourceModel(value.sourceModel),
        translatedAt: value.translatedAt,
        entryCount: Object.keys(messages).length,
        messages,
      };
      loaded.push(safeRecord);
    } catch {
      // Ignore malformed/oversized persisted dictionaries rather than
      // allowing untrusted storage contents to block the Options page.
    }
  }
  // A completed load is a full refresh of the persisted index. Replace the
  // cache only after every record has been checked so stale or invalid entries
  // cannot survive a reload; a storage-read failure leaves the old cache intact.
  memory.clear();
  for (const record of loaded) memory.set(record.tag, record);
  return loaded.sort((a, b) => b.translatedAt - a.translatedAt);
}

export function resetUserLocaleCacheForTest(): void {
  memory.clear();
}
