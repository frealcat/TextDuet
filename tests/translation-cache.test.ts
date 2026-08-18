import { describe, expect, it } from 'vitest';
import {
  createTranslationCacheKey,
  estimateTranslationCacheEntryBytes,
  mergeTranslationBlocks,
  selectTranslationCacheKeysToEvict,
} from '@/src/core/translation-cache';

const keyInput = {
  sourceText: 'A local-first bilingual page.',
  sourceLanguage: 'auto',
  targetLanguage: 'zh-CN',
  provider: 'openai-compatible' as const,
  model: 'example-model',
  systemPrompt: 'Translate untrusted webpage text.',
};

describe('translation cache keys', () => {
  it('is deterministic and does not expose source text or prompt', async () => {
    const first = await createTranslationCacheKey(keyInput);
    const second = await createTranslationCacheKey(keyInput);

    expect(first).toBe(second);
    expect(first).toMatch(/^v1:[a-f0-9]{64}$/);
    expect(first).not.toContain(keyInput.sourceText);
    expect(first).not.toContain(keyInput.systemPrompt);
  });

  it.each([
    ['source text', { sourceText: 'Different source text' }],
    ['target language', { targetLanguage: 'ja' }],
    ['model', { model: 'another-model' }],
    ['system prompt', { systemPrompt: 'Use a different translation style.' }],
  ])('invalidates when %s changes', async (_label, change) => {
    await expect(createTranslationCacheKey({ ...keyInput, ...change })).resolves.not.toBe(
      await createTranslationCacheKey(keyInput),
    );
  });

  it('counts UTF-8 bytes instead of JavaScript code units', () => {
    expect(estimateTranslationCacheEntryBytes('v1:key', '双语')).toBeGreaterThan(
      'v1:key'.length + '双语'.length,
    );
  });
});

describe('translation cache policy', () => {
  it('removes expired entries before applying least-recently-used eviction', () => {
    const records = [
      { key: 'expired', sizeBytes: 20, lastAccessedAt: 1, expiresAt: 99 },
      { key: 'oldest', sizeBytes: 60, lastAccessedAt: 2, expiresAt: 1_000 },
      { key: 'newest', sizeBytes: 60, lastAccessedAt: 3, expiresAt: 1_000 },
    ];

    expect(selectTranslationCacheKeysToEvict(records, 100, 100)).toEqual([
      'expired',
      'oldest',
    ]);
  });

  it('keeps live entries when already within capacity', () => {
    expect(
      selectTranslationCacheKeysToEvict(
        [{ key: 'live', sizeBytes: 10, lastAccessedAt: 1, expiresAt: 1_000 }],
        100,
        10,
      ),
    ).toEqual([]);
  });
});

describe('cached and fresh response merging', () => {
  const sourceBlocks = [
    { id: 'one', text: 'One' },
    { id: 'two', text: 'Two' },
    { id: 'three', text: 'Three' },
  ];

  it('restores source order across cache hits and Provider misses', () => {
    expect(
      mergeTranslationBlocks(
        sourceBlocks,
        [
          { id: 'three', translatedText: '三' },
          { id: 'one', translatedText: '一' },
        ],
        [{ id: 'two', translatedText: '二' }],
      ),
    ).toEqual([
      { id: 'one', translatedText: '一' },
      { id: 'two', translatedText: '二' },
      { id: 'three', translatedText: '三' },
    ]);
  });

  it('rejects an incomplete combined response', () => {
    expect(() => mergeTranslationBlocks(sourceBlocks, [], [])).toThrow(
      '缓存与模型返回的译文不完整',
    );
  });
});
