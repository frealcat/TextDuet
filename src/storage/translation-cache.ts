import * as z from 'zod/mini';
import type {
  ProviderSettings,
  TranslatedBlock,
  TranslationBatchRequest,
  TranslationBlock,
  TranslationCacheDashboard,
} from '@/src/core/contracts';
import {
  createTranslationCacheKey,
  estimateTranslationCacheEntryBytes,
  selectTranslationCacheKeysToEvict,
  TRANSLATION_CACHE_MAX_BYTES,
  TRANSLATION_CACHE_TTL_DAYS,
  TRANSLATION_CACHE_TTL_MS,
  TRANSLATION_CACHE_VERSION,
} from '@/src/core/translation-cache';

const DATABASE_NAME = 'textduet-translation-cache';
const DATABASE_VERSION = 1;
const CACHE_STORE = 'translations';
const LAST_ACCESSED_INDEX = 'lastAccessedAt';

const StoredTranslationCacheEntrySchema = z.strictObject({
  key: z.string().check(z.minLength(1), z.maxLength(128)),
  version: z.literal(TRANSLATION_CACHE_VERSION),
  translatedText: z.string().check(z.minLength(1), z.maxLength(16_000)),
  createdAt: z.int().check(z.nonnegative()),
  lastAccessedAt: z.int().check(z.nonnegative()),
  expiresAt: z.int().check(z.nonnegative()),
  sizeBytes: z.int().check(z.nonnegative()),
});

type StoredTranslationCacheEntry = z.infer<typeof StoredTranslationCacheEntrySchema>;

export interface TranslationCacheLookup {
  cachedBlocks: TranslatedBlock[];
  missingBlocks: TranslationBlock[];
}

let databasePromise: Promise<IDBDatabase> | undefined;

export async function lookupTranslationCache(
  settings: ProviderSettings,
  request: TranslationBatchRequest,
  systemPrompt: string,
): Promise<TranslationCacheLookup> {
  const keyedBlocks = await createKeyedBlocks(settings, request, systemPrompt);
  const database = await openDatabase();
  const transaction = database.transaction(CACHE_STORE, 'readwrite');
  const completion = transactionComplete(transaction);
  const store = transaction.objectStore(CACHE_STORE);
  const rawEntries = await Promise.all(
    keyedBlocks.map(({ key }) => requestResult<unknown>(store.get(key))),
  );
  const now = Date.now();
  const cachedBlocks: TranslatedBlock[] = [];
  const missingBlocks: TranslationBlock[] = [];

  for (const [index, keyedBlock] of keyedBlocks.entries()) {
    const parsed = StoredTranslationCacheEntrySchema.safeParse(rawEntries[index]);
    if (!parsed.success || parsed.data.expiresAt <= now) {
      if (rawEntries[index] !== undefined) {
        store.delete(keyedBlock.key);
      }
      missingBlocks.push(keyedBlock.block);
      continue;
    }

    store.put({ ...parsed.data, lastAccessedAt: now });
    cachedBlocks.push({
      id: keyedBlock.block.id,
      translatedText: parsed.data.translatedText,
    });
  }

  await completion;
  return { cachedBlocks, missingBlocks };
}

export async function storeTranslationCache(
  settings: ProviderSettings,
  request: TranslationBatchRequest,
  systemPrompt: string,
  translations: readonly TranslatedBlock[],
): Promise<void> {
  const sourceBlocksById = new Map(request.blocks.map((block) => [block.id, block]));
  const blocks = translations.map((translation) => {
    const sourceBlock = sourceBlocksById.get(translation.id);
    if (!sourceBlock) {
      throw new Error('无法缓存未请求的译文');
    }
    return { sourceBlock, translation };
  });
  const keyedBlocks = await Promise.all(
    blocks.map(async ({ sourceBlock, translation }) => ({
      key: await createTranslationCacheKey({
        sourceText: sourceBlock.text,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        provider: settings.provider,
        model: settings.model,
        systemPrompt,
      }),
      translation,
    })),
  );
  const database = await openDatabase();
  const transaction = database.transaction(CACHE_STORE, 'readwrite');
  const completion = transactionComplete(transaction);
  const store = transaction.objectStore(CACHE_STORE);
  const now = Date.now();

  for (const { key, translation } of keyedBlocks) {
    const entry: StoredTranslationCacheEntry = {
      key,
      version: TRANSLATION_CACHE_VERSION,
      translatedText: translation.translatedText,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: now + TRANSLATION_CACHE_TTL_MS,
      sizeBytes: estimateTranslationCacheEntryBytes(key, translation.translatedText),
    };
    store.put(entry);
  }

  const rawEntries = await requestResult<unknown[]>(store.getAll());
  const validEntries = rawEntries.flatMap((entry) => {
    const parsed = StoredTranslationCacheEntrySchema.safeParse(entry);
    if (parsed.success) {
      return [parsed.data];
    }
    if (isStoredKey(entry)) {
      store.delete(entry.key);
    }
    return [];
  });
  const keysToEvict = selectTranslationCacheKeysToEvict(validEntries, now);
  for (const key of keysToEvict) {
    store.delete(key);
  }

  await completion;
}

export async function getTranslationCacheDashboard(): Promise<TranslationCacheDashboard> {
  const database = await openDatabase();
  const transaction = database.transaction(CACHE_STORE, 'readwrite');
  const completion = transactionComplete(transaction);
  const store = transaction.objectStore(CACHE_STORE);
  const rawEntries = await requestResult<unknown[]>(store.getAll());
  const now = Date.now();
  const validEntries = rawEntries.flatMap((entry) => {
    const parsed = StoredTranslationCacheEntrySchema.safeParse(entry);
    if (!parsed.success) {
      const key = isStoredKey(entry) ? entry.key : undefined;
      if (key) {
        store.delete(key);
      }
      return [];
    }
    if (parsed.data.expiresAt <= now) {
      store.delete(parsed.data.key);
      return [];
    }
    return [parsed.data];
  });
  await completion;

  return {
    entryCount: validEntries.length,
    sizeBytes: validEntries.reduce((total, entry) => total + entry.sizeBytes, 0),
    maxSizeBytes: TRANSLATION_CACHE_MAX_BYTES,
    ttlDays: TRANSLATION_CACHE_TTL_DAYS,
    isAvailable: true,
  };
}

export async function clearTranslationCache(): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(CACHE_STORE, 'readwrite');
  const completion = transactionComplete(transaction);
  transaction.objectStore(CACHE_STORE).clear();
  await completion;
}

export function createUnavailableTranslationCacheDashboard(): TranslationCacheDashboard {
  return {
    entryCount: 0,
    sizeBytes: 0,
    maxSizeBytes: TRANSLATION_CACHE_MAX_BYTES,
    ttlDays: TRANSLATION_CACHE_TTL_DAYS,
    isAvailable: false,
  };
}

async function createKeyedBlocks(
  settings: ProviderSettings,
  request: TranslationBatchRequest,
  systemPrompt: string,
): Promise<Array<{ block: TranslationBlock; key: string }>> {
  return Promise.all(
    request.blocks.map(async (block) => ({
      block,
      key: await createTranslationCacheKey({
        sourceText: block.text,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
        provider: settings.provider,
        model: settings.model,
        systemPrompt,
      }),
    })),
  );
}

function openDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CACHE_STORE)) {
        const store = database.createObjectStore(CACHE_STORE, { keyPath: 'key' });
        store.createIndex(LAST_ACCESSED_INDEX, 'lastAccessedAt', { unique: false });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        databasePromise = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      databasePromise = undefined;
      reject(new Error('无法打开本地翻译缓存'));
    };
    request.onblocked = () => {
      databasePromise = undefined;
      reject(new Error('本地翻译缓存暂时不可用'));
    };
  });
  return databasePromise;
}

function isStoredKey(value: unknown): value is { key: string } {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'key' in value &&
    typeof value.key === 'string',
  );
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('读取本地翻译缓存失败'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('保存本地翻译缓存失败'));
    transaction.onabort = () => reject(new Error('保存本地翻译缓存失败'));
  });
}
