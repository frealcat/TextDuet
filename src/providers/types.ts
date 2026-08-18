import type {
  ModelUsage,
  ProviderSettings,
  TranslatedBlock,
  TranslationBatchRequest,
} from '@/src/core/contracts';

export interface ProviderRequestOptions {
  signal?: AbortSignal;
}

export interface ProviderTranslationResult {
  blocks: TranslatedBlock[];
  model: string;
  usage?: ModelUsage;
}

export interface TranslationProvider {
  translate(
    settings: ProviderSettings,
    apiKey: string,
    request: TranslationBatchRequest,
    options?: ProviderRequestOptions,
  ): Promise<ProviderTranslationResult>;

  testConnection(
    settings: ProviderSettings,
    apiKey: string,
    options?: ProviderRequestOptions,
  ): Promise<void>;
}
