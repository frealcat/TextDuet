import { describe, expect, it } from 'vitest';
import { contentHash } from '@/src/translator/content-hash';

describe('contentHash', () => {
  it('returns a stable 64-char hex string for the same input', async () => {
    const a = await contentHash('Hello world', 'zh-CN');
    const b = await contentHash('Hello world', 'zh-CN');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different hashes for different target languages', async () => {
    const en = await contentHash('Hello world', 'en');
    const zh = await contentHash('Hello world', 'zh-CN');
    expect(en).not.toBe(zh);
  });

  it('normalises whitespace and unicode so equivalent inputs hash equal', async () => {
    const a = await contentHash('  Hello   world  ', 'en');
    const b = await contentHash('Hello world', 'en');
    expect(a).toBe(b);

    // e + combining acute accent (decomposed) === é (composed)
    const composed = await contentHash('é', 'en');
    const decomposed = await contentHash('é', 'en');
    expect(composed).toBe(decomposed);
  });

  it('changes the hash when the model hint changes', async () => {
    const noHint = await contentHash('text', 'en');
    const withHint = await contentHash('text', 'en', 'gpt-4o-mini');
    expect(noHint).not.toBe(withHint);
  });
});
