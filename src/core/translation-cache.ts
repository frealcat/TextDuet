import type {
  TranslatedBlock,
  TranslationBlock,
} from './contracts';

export const TRANSLATION_CACHE_VERSION = 1;
export const TRANSLATION_PROMPT_VERSION = '1';
export const TRANSLATION_CACHE_TTL_DAYS = 30;
export const TRANSLATION_CACHE_TTL_MS = TRANSLATION_CACHE_TTL_DAYS * 24 * 60 * 60 * 1_000;
export const TRANSLATION_CACHE_MAX_BYTES = 50 * 1024 * 1024;

export interface TranslationCacheKeyInput {
  sourceText: string;
  sourceLanguage: string;
  targetLanguage: string;
  provider: 'openai-compatible';
  model: string;
  systemPrompt: string;
}

export interface TranslationCachePolicyRecord {
  key: string;
  sizeBytes: number;
  lastAccessedAt: number;
  expiresAt: number;
}

/** Builds a content-addressed key without persisting the source text or prompt. */
export async function createTranslationCacheKey(
  input: TranslationCacheKeyInput,
): Promise<string> {
  const canonicalInput = JSON.stringify([
    TRANSLATION_CACHE_VERSION,
    TRANSLATION_PROMPT_VERSION,
    input.provider,
    input.model,
    input.sourceLanguage,
    input.targetLanguage,
    input.systemPrompt,
    input.sourceText,
  ]);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalInput),
  );
  const hexadecimalDigest = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')).join('');
  return `v${TRANSLATION_CACHE_VERSION}:${hexadecimalDigest}`;
}

export function estimateTranslationCacheEntryBytes(
  key: string,
  translatedText: string,
): number {
  const encoder = new TextEncoder();
  return encoder.encode(key).byteLength + encoder.encode(translatedText).byteLength + 64;
}

/** Selects expired entries first, then least-recently-used entries until within capacity. */
export function selectTranslationCacheKeysToEvict(
  records: readonly TranslationCachePolicyRecord[],
  now: number,
  maxBytes = TRANSLATION_CACHE_MAX_BYTES,
): string[] {
  const expiredKeys = new Set(
    records.filter((record) => record.expiresAt <= now).map((record) => record.key),
  );
  const liveRecords = records.filter((record) => !expiredKeys.has(record.key));
  let liveBytes = liveRecords.reduce((total, record) => total + record.sizeBytes, 0);
  const keysToEvict = [...expiredKeys];

  for (const record of [...liveRecords].sort(
    (left, right) => left.lastAccessedAt - right.lastAccessedAt,
  )) {
    if (liveBytes <= maxBytes) {
      break;
    }
    keysToEvict.push(record.key);
    liveBytes -= record.sizeBytes;
  }

  return keysToEvict;
}

export function mergeTranslationBlocks(
  sourceBlocks: readonly TranslationBlock[],
  cachedBlocks: readonly TranslatedBlock[],
  freshBlocks: readonly TranslatedBlock[],
): TranslatedBlock[] {
  const translationsById = new Map(
    [...cachedBlocks, ...freshBlocks].map((block) => [block.id, block]),
  );

  return sourceBlocks.map((block) => {
    const translation = translationsById.get(block.id);
    if (!translation) {
      throw new Error('缓存与模型返回的译文不完整');
    }
    return translation;
  });
}
