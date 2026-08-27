import { storage } from '#imports';
import type { CostSettings, ProviderSettings } from '@/src/core/contracts';
import { DEFAULT_COST_SETTINGS, DEFAULT_PROVIDER_SETTINGS } from '@/src/core/defaults';
import { normalizeBaseUrlOrigin, type OriginApiKeyMap } from './provider-models';

export const providerSettingsStorage = storage.defineItem<ProviderSettings>(
  'local:textduet.providerSettings',
  {
    fallback: DEFAULT_PROVIDER_SETTINGS,
  },
);

export const costSettingsStorage = storage.defineItem<CostSettings>('local:textduet.costSettings', {
  fallback: DEFAULT_COST_SETTINGS,
});

const persistentApiKeyStorage = storage.defineItem<string>('local:textduet.providerApiKey', {
  fallback: '',
});

const sessionApiKeyStorage = storage.defineItem<string>('session:textduet.providerApiKey', {
  fallback: '',
});

/**
 * Persist the API key under the per-origin map keyed by `baseUrl`'s
 * origin. The legacy single global `local:textduet.providerApiKey` /
 * `session:textduet.providerApiKey` slots are also kept in sync so any
 * older reader (or background SW connection test) still sees the
 * active key without a code change. Use `setLegacyGlobal: false` to
 * opt out when the caller already wrote the legacy slot.
 */
export async function saveApiKey(
  apiKey: string,
  persistence: ProviderSettings['apiKeyPersistence'],
  baseUrl: string,
  options?: { apiKeyByOrigin?: OriginApiKeyMap; setLegacyGlobal?: boolean },
): Promise<void> {
  const origin = normalizeBaseUrlOrigin(baseUrl);
  const trimmed = apiKey.trim();
  if (origin && trimmed) {
    const map: OriginApiKeyMap = { ...(options?.apiKeyByOrigin ?? {}) };
    map[origin] = trimmed;
    const current = await providerSettingsStorage.getValue();
    // The PublicProviderSettingsSchema deliberately omits apiKey +
    // apiKeyByOrigin so the runtime contract for Popup/Options pages
    // never carries the raw key. ProviderSettings still holds them
    // internally; we cast through the public view to add the extra
    // fields without polluting the schema.
    const next = {
      ...current,
      apiKey: trimmed,
      apiKeyByOrigin: map,
    } as ProviderSettings & {
      apiKey?: string;
      apiKeyByOrigin?: OriginApiKeyMap;
    };
    await providerSettingsStorage.setValue(next as ProviderSettings);
  }
  if (options?.setLegacyGlobal !== false) {
    if (persistence === 'local') {
      if (trimmed) await persistentApiKeyStorage.setValue(trimmed);
      else await persistentApiKeyStorage.removeValue();
      await sessionApiKeyStorage.removeValue();
    } else if (trimmed) {
      await sessionApiKeyStorage.setValue(trimmed);
      await persistentApiKeyStorage.removeValue();
    } else {
      await Promise.all([
        persistentApiKeyStorage.removeValue(),
        sessionApiKeyStorage.removeValue(),
      ]);
    }
  }
}

/**
 * Return the API key for the given baseUrl's origin. Falls back to
 * the active single key when the per-origin map is missing or
 * before the migration runs. The caller should pass the latest
 * `apiKeyByOrigin` snapshot from `providerSettingsStorage`.
 */
export async function getApiKey(
  persistence: ProviderSettings['apiKeyPersistence'],
  baseUrl: string,
  options?: { apiKeyByOrigin?: OriginApiKeyMap },
): Promise<string> {
  const origin = normalizeBaseUrlOrigin(baseUrl);
  if (origin && options?.apiKeyByOrigin && options.apiKeyByOrigin[origin]) {
    return options.apiKeyByOrigin[origin].trim();
  }
  return persistence === 'local'
    ? persistentApiKeyStorage.getValue()
    : sessionApiKeyStorage.getValue();
}

export async function clearApiKeys(): Promise<void> {
  await Promise.all([
    persistentApiKeyStorage.removeValue(),
    sessionApiKeyStorage.removeValue(),
  ]);
}
