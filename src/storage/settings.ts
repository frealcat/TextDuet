import { storage } from '#imports';
import type { CostSettings, ProviderSettings } from '@/src/core/contracts';
import { DEFAULT_COST_SETTINGS, DEFAULT_PROVIDER_SETTINGS } from '@/src/core/defaults';

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

export async function saveApiKey(
  apiKey: string,
  persistence: ProviderSettings['apiKeyPersistence'],
): Promise<void> {
  if (persistence === 'local') {
    await persistentApiKeyStorage.setValue(apiKey);
    await sessionApiKeyStorage.removeValue();
    return;
  }

  await sessionApiKeyStorage.setValue(apiKey);
  await persistentApiKeyStorage.removeValue();
}

export async function getApiKey(
  persistence: ProviderSettings['apiKeyPersistence'],
): Promise<string> {
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
