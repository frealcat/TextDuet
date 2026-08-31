import type {
  ModelUsage,
  ProviderSettings,
  TranslatedBlock,
  TranslationBatchRequest,
} from '@/src/core/contracts';

export interface ProviderRequestOptions {
  signal?: AbortSignal;
}

export interface ProviderStreamOptions extends ProviderRequestOptions {
  /** Called only after the complete response passes envelope/ID validation. */
  onBlock?: (block: TranslatedBlock) => void;
}

export interface ProviderTranslationResult {
  blocks: TranslatedBlock[];
  model: string;
  usage?: ModelUsage;
}

export interface ProviderTranslationStreamResult extends ProviderTranslationResult {
  isStreaming: boolean;
}

export class ProviderStreamError extends Error {
  readonly usage?: ModelUsage;

  constructor(message: string, usage?: ModelUsage) {
    super(message);
    this.name = 'ProviderStreamError';
    this.usage = usage;
  }
}

export interface TranslationProvider {
  translate(
    settings: ProviderSettings,
    apiKey: string,
    request: TranslationBatchRequest,
    options?: ProviderRequestOptions,
  ): Promise<ProviderTranslationResult>;

  translateStream(
    settings: ProviderSettings,
    apiKey: string,
    request: TranslationBatchRequest,
    options?: ProviderStreamOptions,
  ): Promise<ProviderTranslationStreamResult>;

  testConnection(
    settings: ProviderSettings,
    apiKey: string,
    options?: ProviderRequestOptions,
  ): Promise<void>;
}
