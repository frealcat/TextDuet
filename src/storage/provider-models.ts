// Per-origin model cache helpers.
//
// `ProviderSettings.model` / `ProviderSettings.models` remain the canonical
// "current" values for backward compatibility with all existing readers
// (Popup, background service worker, cost dashboard, translation cache).
// `modelByOrigin` / `modelsByOrigin` are the persistent per-origin store
// keyed by `new URL(baseUrl).origin`.
//
// Switching `baseUrl` must round-trip the previous origin's values back
// into the maps and load the new origin's values into the active fields.

const ORIGIN_MAX_LENGTH = 2_048;

export type OriginModelMap = Record<string, string>;
export type OriginModelListMap = Record<string, readonly string[]>;

export function normalizeBaseUrlOrigin(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
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
 */
export function switchBaseUrlWithModelCache<
  T extends {
    baseUrl: string;
    model: string;
    models?: string[];
    modelByOrigin?: OriginModelMap;
    modelsByOrigin?: OriginModelListMap;
  },
>(previous: T, newBaseUrl: string): T {
  const oldOrigin = normalizeBaseUrlOrigin(previous.baseUrl);
  const newOrigin = normalizeBaseUrlOrigin(newBaseUrl);

  const modelByOrigin: OriginModelMap = { ...(previous.modelByOrigin ?? {}) };
  const modelsByOrigin: OriginModelListMap = { ...(previous.modelsByOrigin ?? {}) };

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
  }

  let newModel = '';
  let newList: string[] = [];
  if (newOrigin) {
    const cachedModel = modelByOrigin[newOrigin];
    if (typeof cachedModel === 'string' && cachedModel.trim()) {
      newModel = cachedModel.trim();
    }
    const cachedList = modelsByOrigin[newOrigin];
    if (Array.isArray(cachedList)) {
      newList = trimModelList(cachedList);
    }
  }

  return {
    ...previous,
    baseUrl: newBaseUrl,
    model: newModel,
    models: newList,
    modelByOrigin,
    modelsByOrigin,
  };
}

/**
 * Update the per-origin cache after the user edits the active `model` or
 * `models` in the UI. Also writes the new values back to the active
 * fields so the caller (typically `setSettings` in Options App) sees
 * the updated state in the next render — without this round-trip the
 * `ModelTagInput` would lose the freshly-added tag.
 */
export function writeActiveModelToOriginCache<
  T extends {
    baseUrl: string;
    model: string;
    models?: string[];
    modelByOrigin?: OriginModelMap;
    modelsByOrigin?: OriginModelListMap;
  },
>(input: T, next: { model?: string; models?: readonly string[] }): T {
  const origin = normalizeBaseUrlOrigin(input.baseUrl);

  const modelByOrigin: OriginModelMap = { ...(input.modelByOrigin ?? {}) };
  const modelsByOrigin: OriginModelListMap = { ...(input.modelsByOrigin ?? {}) };

  let activeModel = input.model;
  let activeModels = input.models;

  if (next.model !== undefined) {
    const trimmed = next.model.trim();
    activeModel = trimmed;
  }
  if (next.models !== undefined) {
    activeModels = trimModelList(next.models);
  }

  if (!origin) {
    return {
      ...input,
      model: activeModel,
      models: activeModels,
      modelByOrigin,
      modelsByOrigin,
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

  return {
    ...input,
    model: activeModel,
    models: activeModels,
    modelByOrigin,
    modelsByOrigin,
  };
}

/**
 * One-time migration: copy the existing active `model` and `models` into
 * the per-origin maps keyed by the current `baseUrl` origin. Safe to run
 * on every read; it's a no-op when the maps are already populated.
 */
export function migrateProviderModelsToOriginCache<
  T extends {
    baseUrl: string;
    model: string;
    models?: string[];
    modelByOrigin?: OriginModelMap;
    modelsByOrigin?: OriginModelListMap;
  },
>(input: T): T {
  const origin = normalizeBaseUrlOrigin(input.baseUrl);
  const modelByOrigin: OriginModelMap = { ...(input.modelByOrigin ?? {}) };
  const modelsByOrigin: OriginModelListMap = { ...(input.modelsByOrigin ?? {}) };

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
  }

  return {
    ...input,
    modelByOrigin,
    modelsByOrigin,
  };
}

export const __INTERNAL = { ORIGIN_MAX_LENGTH, trimModelList };
