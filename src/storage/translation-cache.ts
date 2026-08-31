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
import {
  decryptWithVault,
  encryptWithVault,
  getVaultStatus,
  VaultLockedError,
  VaultNotInitializedError,
  type VaultCiphertext,
} from './vault';
import { createOperationQueue } from './operation-queue';

const DATABASE_NAME = 'textduet-translation-cache';
// v1 stored translatedText in cleartext. v2 drops every pre-existing record
// during upgrade before the new encrypted record shape is used.
const DATABASE_VERSION = 2;
const CACHE_STORE = 'translations';
const LAST_ACCESSED_INDEX = 'lastAccessedAt';
const CACHE_VAULT_PURPOSE = 'translation-cache';

const StoredTranslationCiphertextSchema = z.strictObject({
  version: z.literal(1),
  iv: z.string().check(z.minLength(1), z.maxLength(64)),
  ciphertext: z.string().check(z.minLength(1), z.maxLength(120 * 1024)),
});

const StoredTranslationCacheEntrySchema = z.strictObject({
  key: z.string().check(z.minLength(1), z.maxLength(128)),
  version: z.literal(TRANSLATION_CACHE_VERSION),
  encryptedText: StoredTranslationCiphertextSchema,
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

export interface TranslationCacheStoreOptions {
  /** Generation captured when the enclosing translation operation began. */
  generation?: number;
}

let databasePromise: Promise<IDBDatabase> | undefined;
const cacheOperations = createOperationQueue();
let cacheGeneration = 0;

/** Returns the current cache generation for a long-running translation flow. */
export function getTranslationCacheGeneration(): number {
  return cacheGeneration;
}

export function lookupTranslationCache(
  settings: ProviderSettings,
  request: TranslationBatchRequest,
  systemPrompt: string,
): Promise<TranslationCacheLookup> {
  return cacheOperations(() => lookupTranslationCacheInternal(settings, request, systemPrompt));
}

async function lookupTranslationCacheInternal(
  settings: ProviderSettings,
  request: TranslationBatchRequest,
  systemPrompt: string,
): Promise<TranslationCacheLookup> {
  const keyedBlocks = await createKeyedBlocks(settings, request, systemPrompt);
  const database = await openDatabase();
  // Opening first also runs the v1 -> v2 upgrade, which atomically removes
  // any legacy cleartext records even when the Vault is currently locked.
  await assertCacheVaultAvailable();
  const readTransaction = database.transaction(CACHE_STORE, 'readonly');
  const readCompletion = transactionComplete(readTransaction);
  const readStore = readTransaction.objectStore(CACHE_STORE);
  const rawEntries = await Promise.all(keyedBlocks.map(({ key }) => requestResult<unknown>(readStore.get(key))));
  await readCompletion;
  const now = Date.now();
  const cachedBlocks: TranslatedBlock[] = [];
  const missingBlocks: TranslationBlock[] = [];
  const entriesToTouch: Array<{ key: string; entry: StoredTranslationCacheEntry }> = [];
  const keysToDelete: string[] = [];

  for (const [index, keyedBlock] of keyedBlocks.entries()) {
    const parsed = StoredTranslationCacheEntrySchema.safeParse(rawEntries[index]);
    if (!parsed.success || parsed.data.expiresAt <= now) {
      if (rawEntries[index] !== undefined) {
        keysToDelete.push(keyedBlock.key);
      }
      missingBlocks.push(keyedBlock.block);
      continue;
    }

    try {
      const translatedText = await decryptCachedText(parsed.data.encryptedText);
      entriesToTouch.push({
        key: keyedBlock.key,
        entry: parsed.data,
      });
      cachedBlocks.push({ id: keyedBlock.block.id, translatedText });
    } catch (error) {
      // A record that cannot authenticate is treated as stale/corrupt and
      // removed. Vault availability errors must still reach the caller so the
      // Service Worker can report an unavailable cache rather than a miss.
      if (isVaultAvailabilityError(error)) throw error;
      keysToDelete.push(keyedBlock.key);
      missingBlocks.push(keyedBlock.block);
    }
  }

  if (entriesToTouch.length > 0 || keysToDelete.length > 0) {
    const writeTransaction = database.transaction(CACHE_STORE, 'readwrite');
    const writeCompletion = transactionComplete(writeTransaction);
    const writeStore = writeTransaction.objectStore(CACHE_STORE);
    for (const key of keysToDelete) writeStore.delete(key);
    for (const { key, entry } of entriesToTouch) {
      writeStore.put({ ...entry, lastAccessedAt: now, key });
    }
    await writeCompletion;
  }
  return { cachedBlocks, missingBlocks };
}

export function storeTranslationCache(
  settings: ProviderSettings,
  request: TranslationBatchRequest,
  systemPrompt: string,
  translations: readonly TranslatedBlock[],
  options: TranslationCacheStoreOptions = {},
): Promise<boolean> {
  const generation = options.generation ?? cacheGeneration;
  return cacheOperations(() => storeTranslationCacheInternal(
    settings,
    request,
    systemPrompt,
    translations,
    generation,
  ));
}

async function storeTranslationCacheInternal(
  settings: ProviderSettings,
  request: TranslationBatchRequest,
  systemPrompt: string,
  translations: readonly TranslatedBlock[],
  generation: number,
): Promise<boolean> {
  // A clear request increments the generation synchronously, even while an
  // earlier Provider call is still in flight. Do not let that stale call
  // recreate entries after the user's clear operation completes.
  if (generation !== cacheGeneration) return false;
  const sourceBlocksById = new Map(request.blocks.map((block) => [block.id, block]));
  const blocks = translations.map((translation) => {
    const sourceBlock = sourceBlocksById.get(translation.id);
    if (!sourceBlock) {
      throw new Error('无法缓存未请求的译文');
    }
    assertTranslatedText(translation.translatedText);
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
  await assertCacheVaultAvailable();
  // Crypto is intentionally completed before opening the IDB write
  // transaction. Awaiting WebCrypto while a transaction is idle can make the
  // transaction inactive in Chromium.
  const encryptedBlocks = await Promise.all(
    keyedBlocks.map(async ({ key, translation }) => {
      const encryptedText = await encryptWithVault(
        new TextEncoder().encode(translation.translatedText),
        CACHE_VAULT_PURPOSE,
      );
      return { key, encryptedText };
    }),
  );
  if (generation !== cacheGeneration) return false;
  const transaction = database.transaction(CACHE_STORE, 'readwrite');
  const completion = transactionComplete(transaction);
  const store = transaction.objectStore(CACHE_STORE);
  const now = Date.now();

  for (const { key, encryptedText } of encryptedBlocks) {
    const entry: StoredTranslationCacheEntry = {
      key,
      version: TRANSLATION_CACHE_VERSION,
      encryptedText,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: now + TRANSLATION_CACHE_TTL_MS,
      // Count the serialized encrypted value toward the same 50 MiB policy;
      // this keeps the cap honest despite base64/GCM overhead.
      sizeBytes: estimateTranslationCacheEntryBytes(key, JSON.stringify(encryptedText)),
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
  return true;
}

export function getTranslationCacheDashboard(): Promise<TranslationCacheDashboard> {
  return cacheOperations(getTranslationCacheDashboardInternal);
}

async function getTranslationCacheDashboardInternal(): Promise<TranslationCacheDashboard> {
  const database = await openDatabase();
  // Ensure legacy cleartext records are purged before checking Vault state.
  await assertCacheVaultAvailable();
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

export function clearTranslationCache(): Promise<void> {
  // Advance before enqueueing so any operation that has not reached its write
  // phase yet is invalidated immediately. The queue still guarantees that a
  // currently active transaction finishes before the clear transaction.
  cacheGeneration += 1;
  return cacheOperations(clearTranslationCacheInternal);
}

async function clearTranslationCacheInternal(): Promise<void> {
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

async function assertCacheVaultAvailable(): Promise<void> {
  const status = await getVaultStatus();
  if (!status.exists) throw new VaultNotInitializedError();
  if (!status.isUnlocked) throw new VaultLockedError();
}

async function decryptCachedText(value: VaultCiphertext): Promise<string> {
  const bytes = await decryptWithVault(value, CACHE_VAULT_PURPOSE);
  const translatedText = new TextDecoder().decode(bytes);
  assertTranslatedText(translatedText);
  return translatedText;
}

function assertTranslatedText(value: string): void {
  if (!value.trim() || value.length > 16_000) {
    throw new Error('本地翻译缓存内容无效');
  }
}

function isVaultAvailabilityError(error: unknown): boolean {
  return error instanceof VaultLockedError || error instanceof VaultNotInitializedError;
}

function openDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = (event) => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CACHE_STORE)) {
        const store = database.createObjectStore(CACHE_STORE, { keyPath: 'key' });
        store.createIndex(LAST_ACCESSED_INDEX, 'lastAccessedAt', { unique: false });
      } else if (request.transaction && (event as IDBVersionChangeEvent).oldVersion < DATABASE_VERSION) {
        // v1 records contain cleartext `translatedText`; there is no safe way
        // to migrate them without exposing plaintext outside the vault, so
        // delete them atomically during the schema upgrade.
        request.transaction.objectStore(CACHE_STORE).clear();
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
