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

function isRecord(value: unknown): value is UserLocaleRecord {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.tag === 'string'
    && typeof v.promptVersion === 'string'
    && typeof v.sourceModel === 'string'
    && typeof v.translatedAt === 'number'
    && typeof v.entryCount === 'number'
    && v.messages !== null
    && typeof v.messages === 'object';
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
  if (tag === 'zh-CN' || tag === 'en') {
    throw new Error(`setUserLocale: '${tag}' is a built-in locale`);
  }
  const entryCount = Object.keys(messages).length;
  const record: UserLocaleRecord = {
    tag,
    promptVersion: I18N_PROMPT_VERSION,
    sourceModel,
    translatedAt: now,
    entryCount,
    messages,
  };
  memory.set(tag, record);
  const backend = defaultBackend();
  await backend.setItem(userLocaleStorageKey(tag, I18N_PROMPT_VERSION), record);
  // Maintain a small index so loadAllUserLocales doesn't need full
  // `get(null)` capability (which the injected test backend doesn't
  // provide).
  const indexKey = '__textduet_user_locale_index__';
  const existing = (await backend.getItem(indexKey)) as { tags?: string[] } | undefined;
  const tags = Array.isArray(existing?.tags) ? existing!.tags : [];
  if (!tags.includes(tag)) tags.push(tag);
  await backend.setItem(indexKey, { tags });
  setLocaleOnly(tag as LocaleTag);
  return record;
}

export async function clearUserLocale(tag: string): Promise<boolean> {
  const had = memory.delete(tag);
  const backend = defaultBackend();
  await backend.removeItem(userLocaleStorageKey(tag, I18N_PROMPT_VERSION));
  // Drop the tag from the index.
  const indexKey = '__textduet_user_locale_index__';
  const existing = (await backend.getItem(indexKey)) as { tags?: string[] } | undefined;
  if (Array.isArray(existing?.tags)) {
    const tags = (existing!.tags).filter((t) => t !== tag);
    await backend.setItem(indexKey, { tags });
  }
  return had;
}

export async function clearAllUserLocales(): Promise<number> {
  const tags = [...memory.keys()];
  const backend = defaultBackend();
  await Promise.all(
    tags.map((tag) => backend.removeItem(userLocaleStorageKey(tag, I18N_PROMPT_VERSION))),
  );
  await backend.removeItem('__textduet_user_locale_index__');
  memory.clear();
  return tags.length;
}

export async function loadAllUserLocales(): Promise<UserLocaleRecord[]> {
  // We use a sentinel prefix pattern rather than `get(null)` so the
  // injected test backend works without needing a full `get(null)`
  // capability.
  const all = (await defaultBackend().getItem('__textduet_user_locale_index__')) as
    | { tags: string[] }
    | undefined;
  if (!all || !Array.isArray(all.tags)) return [];
  const loaded: UserLocaleRecord[] = [];
  for (const tag of all.tags) {
    const value = await defaultBackend().getItem(userLocaleStorageKey(tag, I18N_PROMPT_VERSION));
    if (!isRecord(value)) continue;
    memory.set(value.tag, value);
    loaded.push(value);
  }
  return loaded.sort((a, b) => b.translatedAt - a.translatedAt);
}

export function resetUserLocaleCacheForTest(): void {
  memory.clear();
}
