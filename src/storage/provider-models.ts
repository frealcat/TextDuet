// Per-origin model + API-key cache helpers.
//
// `ProviderSettings.model` / `ProviderSettings.models` remain the canonical
// "current" values for backward compatibility with all existing readers
// (Popup, background service worker, cost dashboard, translation cache).
// `modelByOrigin` / `modelsByOrigin` / `apiKeyByOrigin` are the persistent
// per-origin stores keyed by `new URL(baseUrl).origin`.
//
// Switching `baseUrl` must round-trip the previous origin's values back
// into the maps and load the new origin's values into the active fields.

const ORIGIN_MAX_LENGTH = 2_048;
const API_KEY_MAX_LENGTH = 4_096;

export type OriginModelMap = Record<string, string>;
export type OriginModelListMap = Record<string, readonly string[]>;
export type OriginApiKeyMap = Record<string, string>;

export function normalizeBaseUrlOrigin(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Checks whether a redacted API-key status belongs to the currently edited
 * Provider origin. The status returned by the Service Worker is scoped to
 * one origin, so it must not be reused after the Options URL changes.
 */
export function isSavedApiKeyForOrigin(
  hasSavedApiKey: boolean,
  savedOrigin: string | null,
  currentBaseUrl: string,
): boolean {
  if (!hasSavedApiKey || !savedOrigin) return false;
  const currentOrigin = normalizeBaseUrlOrigin(currentBaseUrl);
  return currentOrigin !== null && currentOrigin === savedOrigin;
}

/**
 * A key migration is ambiguous when the Provider origin and persistence mode
 * change in the same save. Callers should persist the origin first, then
 * perform the mode transition against that now-current origin.
 */
export function hasCombinedProviderTransition(
  previous: { baseUrl: string; apiKeyPersistence: string },
  next: { baseUrl: string; apiKeyPersistence: string },
): boolean {
  return previous.apiKeyPersistence !== next.apiKeyPersistence
    && normalizeBaseUrlOrigin(previous.baseUrl) !== normalizeBaseUrlOrigin(next.baseUrl);
}

function trimModelList(models: readonly string[] | undefined): string[] {
  if (!models) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of models) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

/**
 * Returns the model list to expose for a given origin. Falls back to the
 * active `models` array if no per-origin entry exists yet, so that
 * freshly-migrated data still surfaces something usable.
 */
export function getModelsForOrigin(
  baseUrl: string,
  activeModelList: readonly string[] | undefined,
  byOrigin: OriginModelListMap | undefined,
): string[] {
  const origin = normalizeBaseUrlOrigin(baseUrl);
  if (!origin) return trimModelList(activeModelList);
  const cached = byOrigin?.[origin];
  if (cached === undefined) return trimModelList(activeModelList);
  return trimModelList(cached);
}

/**
 * Returns the active model for a given origin. Returns an empty string
 * when the origin has no saved value.
 */
export function getModelForOrigin(
  baseUrl: string,
  byOrigin: OriginModelMap | undefined,
): string {
  const origin = normalizeBaseUrlOrigin(baseUrl);
  if (!origin) return '';
  return byOrigin?.[origin]?.trim() ?? '';
}

/**
 * Apply a baseUrl change. Persists the previous state (still held in
 * `previous` with the old `baseUrl`) into the per-origin maps keyed by
 * its origin, then loads the new origin's cached values into the active
 * fields. If the new origin has no cache, the active fields reset to
 * empty so the user starts with a clean slate for that provider.
 *
 * Also parks / rehydrates the API key under the per-origin key map so
 * each provider (Qwen / OpenAI / DeepSeek / OpenRouter / etc.) keeps
 * its own key across baseUrl toggles. The legacy `apiKey` field is
 * preserved in case downstream readers still expect it.
 */
export function switchBaseUrlWithModelCache<
  T extends {
    baseUrl: string;
    model: string;
    models?: string[];
    modelByOrigin?: OriginModelMap;
    modelsByOrigin?: OriginModelListMap;
    apiKey?: string;
    apiKeyByOrigin?: OriginApiKeyMap;
  },
>(previous: T, newBaseUrl: string): T {
  const oldOrigin = normalizeBaseUrlOrigin(previous.baseUrl);
  const newOrigin = normalizeBaseUrlOrigin(newBaseUrl);

  const modelByOrigin: OriginModelMap = { ...(previous.modelByOrigin ?? {}) };
  const modelsByOrigin: OriginModelListMap = { ...(previous.modelsByOrigin ?? {}) };
  const apiKeyByOrigin: OriginApiKeyMap = { ...(previous.apiKeyByOrigin ?? {}) };

  if (oldOrigin) {
    const trimmedModel = previous.model.trim();
    if (trimmedModel) {
      modelByOrigin[oldOrigin] = trimmedModel;
    } else {
      delete modelByOrigin[oldOrigin];
    }
    const trimmedList = trimModelList(previous.models);
    if (trimmedList.length > 0) {
      modelsByOrigin[oldOrigin] = trimmedList;
    } else {
      delete modelsByOrigin[oldOrigin];
    }
    const trimmedKey = (previous.apiKey ?? '').trim();
    if (trimmedKey) {
      apiKeyByOrigin[oldOrigin] = trimmedKey;
    } else {
      delete apiKeyByOrigin[oldOrigin];
    }
  }

  let newModel = '';
  let newList: string[] = [];
  let newApiKey = '';
  if (newOrigin) {
    const cachedModel = modelByOrigin[newOrigin];
    if (typeof cachedModel === 'string' && cachedModel.trim()) {
      newModel = cachedModel.trim();
    }
    const cachedList = modelsByOrigin[newOrigin];
    if (Array.isArray(cachedList)) {
      newList = trimModelList(cachedList);
    }
    const cachedKey = apiKeyByOrigin[newOrigin];
    if (typeof cachedKey === 'string') {
      newApiKey = cachedKey.trim();
    }
  }

  return {
    ...previous,
    baseUrl: newBaseUrl,
    model: newModel,
    models: newList,
    apiKey: newApiKey,
    modelByOrigin,
    modelsByOrigin,
    apiKeyByOrigin,
  };
}

/**
 * Update the per-origin cache after the user edits the active `model`,
 * `models`, or `apiKey` in the UI. Also writes the new values back to
 * the active fields so the caller (typically `setSettings` in Options
 * App) sees the updated state in the next render — without this
 * round-trip the `ModelTagInput` would lose the freshly-added tag.
 */
export function writeActiveModelToOriginCache<
  T extends {
    baseUrl: string;
    model: string;
    models?: string[];
    apiKey?: string;
    modelByOrigin?: OriginModelMap;
    modelsByOrigin?: OriginModelListMap;
    apiKeyByOrigin?: OriginApiKeyMap;
  },
>(
  input: T,
  next: { model?: string; models?: readonly string[]; apiKey?: string },
): T {
  const origin = normalizeBaseUrlOrigin(input.baseUrl);

  const modelByOrigin: OriginModelMap = { ...(input.modelByOrigin ?? {}) };
  const modelsByOrigin: OriginModelListMap = { ...(input.modelsByOrigin ?? {}) };
  const apiKeyByOrigin: OriginApiKeyMap = { ...(input.apiKeyByOrigin ?? {}) };

  let activeModel = input.model;
  let activeModels = input.models;
  let activeApiKey = input.apiKey;

  if (next.model !== undefined) {
    activeModel = next.model.trim();
  }
  if (next.models !== undefined) {
    activeModels = trimModelList(next.models);
  }
  if (next.apiKey !== undefined) {
    activeApiKey = next.apiKey.trim();
  }

  if (!origin) {
    return {
      ...input,
      model: activeModel,
      models: activeModels,
      apiKey: activeApiKey,
      modelByOrigin,
      modelsByOrigin,
      apiKeyByOrigin,
    };
  }

  if (next.model !== undefined) {
    if (activeModel) {
      modelByOrigin[origin] = activeModel;
    } else {
      delete modelByOrigin[origin];
    }
  }
  if (next.models !== undefined) {
    const finalModels = activeModels ?? [];
    if (finalModels.length > 0) {
      modelsByOrigin[origin] = finalModels;
    } else {
      delete modelsByOrigin[origin];
    }
  }
  if (next.apiKey !== undefined) {
    if (activeApiKey) {
      apiKeyByOrigin[origin] = activeApiKey;
    } else {
      delete apiKeyByOrigin[origin];
    }
  }

  return {
    ...input,
    model: activeModel,
    models: activeModels,
    apiKey: activeApiKey,
    modelByOrigin,
    modelsByOrigin,
    apiKeyByOrigin,
  };
}

/**
 * One-time migration: copy the existing active `model`, `models`, and
 * `apiKey` into the per-origin maps keyed by the current `baseUrl`
 * origin. Safe to run on every read; it's a no-op when the maps are
 * already populated. The legacy top-level `apiKey` field is preserved
 * for backward compatibility (it stays populated after the call so
 * existing readers continue to work).
 */
export function migrateProviderModelsToOriginCache<
  T extends {
    baseUrl: string;
    model: string;
    models?: string[];
    apiKey?: string;
    modelByOrigin?: OriginModelMap;
    modelsByOrigin?: OriginModelListMap;
    apiKeyByOrigin?: OriginApiKeyMap;
  },
>(input: T): T {
  const origin = normalizeBaseUrlOrigin(input.baseUrl);
  const modelByOrigin: OriginModelMap = { ...(input.modelByOrigin ?? {}) };
  const modelsByOrigin: OriginModelListMap = { ...(input.modelsByOrigin ?? {}) };
  const apiKeyByOrigin: OriginApiKeyMap = { ...(input.apiKeyByOrigin ?? {}) };

  if (origin) {
    if (modelByOrigin[origin] === undefined && input.model.trim()) {
      modelByOrigin[origin] = input.model.trim();
    }
    if (modelsByOrigin[origin] === undefined) {
      const trimmedList = trimModelList(input.models);
      if (trimmedList.length > 0) {
        modelsByOrigin[origin] = trimmedList;
      }
    }
    if (apiKeyByOrigin[origin] === undefined) {
      const trimmedKey = (input.apiKey ?? '').trim();
      if (trimmedKey) {
        apiKeyByOrigin[origin] = trimmedKey;
      }
    }
  }

  return {
    ...input,
    modelByOrigin,
    modelsByOrigin,
    apiKeyByOrigin,
  };
}

export const __INTERNAL = { ORIGIN_MAX_LENGTH, trimModelList };
