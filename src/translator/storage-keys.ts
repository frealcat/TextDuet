/**
 * Storage key namespacing (TD-2026-026 Layer 5).
 *
 * Centralises every `chrome.storage.local` / `BroadcastChannel` key
 * the extension uses so the namespaces stay consistent and
 * `chrome.storage.local.remove('textduet.tm')` can wipe the entire
 * translation memory in a single call.
 */

export const STORAGE_NAMESPACE = 'textduet';

export const StorageKeys = {
  /** Layer 5: persisted translation memory across sessions. */
  translationMemory: `${STORAGE_NAMESPACE}.tm`,
  /** M28-style settings (kept here so the namespace stays unified). */
  providerSettings: `${STORAGE_NAMESPACE}.settings`,
  /** L2 page lifetime cache prefix; full key is `prefix + ':' + contentHash`. */
  pageCachePrefix: `${STORAGE_NAMESPACE}.pageCache`,
} as const;

export const BroadcastChannels = {
  translationMemory: `${STORAGE_NAMESPACE}.tm.bus`,
} as const;
