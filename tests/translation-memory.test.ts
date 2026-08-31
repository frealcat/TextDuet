import { describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';
import {
  bindCachedTranslation,
  TranslationMemory,
} from '@/src/translator/translation-memory';
import type { TranslatedBlock } from '@/src/core/contracts';

function makeDocument(html: string): Document {
  return parseHTML('<main>' + html + '</main>').document as unknown as Document;
}

function makeBlock(text: string): TranslatedBlock {
  return { id: 'b1', translatedText: text };
}

function makeMemory(): TranslationMemory {
  return new TranslationMemory();
}

describe('TranslationMemory (page-scoped)', () => {
  it('returns null on a fresh cache', async () => {
    const mem = makeMemory();
    const got = await mem.get('Hello', 'en', 'gpt-4o-mini');
    expect(got).toBeNull();
  });

  it('caches a translation in L2 after the first put', async () => {
    const mem = makeMemory();
    const block = makeBlock('你好');
    await mem.put('Hello', 'en', 'gpt-4o-mini', block);
    const got = await mem.get('Hello', 'en', 'gpt-4o-mini');
    expect(got).toEqual(block);
    expect(mem.l2Size).toBeGreaterThan(0);
  });

  it('uses L1 fast path for the same element reference', async () => {
    const mem = makeMemory();
    const doc = makeDocument('<p id="x">Hello</p>');
    const el = doc.querySelector('#x') as HTMLElement;
    const block = makeBlock('你好');
    await mem.put('Hello', 'en', 'gpt-4o-mini', block, el);
    // Read with the same element: should hit L1
    const got = await mem.get('Hello', 'en', 'gpt-4o-mini', el);
    expect(got).toEqual(block);
  });

  it('does not return a stale L1 translation when the element text changes', async () => {
    const mem = makeMemory();
    const doc = makeDocument('<p id="x">Hello</p>');
    const el = doc.querySelector('#x') as HTMLElement;
    const hello = makeBlock('你好');
    await mem.put('Hello', 'zh-CN', 'gpt-4o-mini', hello, el);

    expect(await mem.get('World', 'zh-CN', 'gpt-4o-mini', el)).toBeNull();
  });

  it('falls back to the matching L2 entry after an element is reused', async () => {
    const mem = makeMemory();
    const doc = makeDocument('<p id="x">Hello</p>');
    const el = doc.querySelector('#x') as HTMLElement;
    const hello = makeBlock('你好');
    const world = makeBlock('世界');
    await mem.put('Hello', 'zh-CN', 'gpt-4o-mini', hello, el);
    await mem.put('World', 'zh-CN', 'gpt-4o-mini', world);

    expect(await mem.get('World', 'zh-CN', 'gpt-4o-mini', el)).toEqual(world);
  });

  it('returns the same translation regardless of which tier serves it', async () => {
    const mem = makeMemory();
    const block = makeBlock('你好');
    await mem.put('Hello', 'en', 'gpt-4o-mini', block);
    const a = await mem.get('Hello', 'en', 'gpt-4o-mini');
    const b = await mem.get('Hello', 'en', 'gpt-4o-mini');
    expect(a).toEqual(b);
    expect(a?.translatedText).toBe('你好');
  });

  it('rebinds a cached result to the current DOM candidate without mutating the cache value', () => {
    const cached: TranslatedBlock = {
      id: 'original-request-id',
      translatedText: 'Home',
      colorPreference: 'preferred',
    };
    const rebound = bindCachedTranslation(cached, 'current-dom-id');
    expect(rebound).toEqual({
      id: 'current-dom-id',
      translatedText: 'Home',
      colorPreference: 'preferred',
    });
    expect(cached.id).toBe('original-request-id');
  });

  it('isolates different target languages from each other', async () => {
    const mem = makeMemory();
    await mem.put('Hello', 'en', 'gpt-4o-mini', makeBlock('Hello'));
    await mem.put('Hello', 'zh-CN', 'gpt-4o-mini', makeBlock('你好'));
    const en = await mem.get('Hello', 'en', 'gpt-4o-mini');
    const zh = await mem.get('Hello', 'zh-CN', 'gpt-4o-mini');
    expect(en?.translatedText).toBe('Hello');
    expect(zh?.translatedText).toBe('你好');
  });

  it('normalises whitespace so equivalent source texts share a cache entry', async () => {
    const mem = makeMemory();
    await mem.put('Hello   world', 'en', 'gpt-4o-mini', makeBlock('Hello world'));
    const got = await mem.get('Hello world', 'en', 'gpt-4o-mini');
    expect(got?.translatedText).toBe('Hello world');
  });

  it('does not share a translation with another page-run memory', async () => {
    const mem = makeMemory();
    const nextRun = makeMemory();
    await mem.put('Hello', 'en', 'gpt-4o-mini', makeBlock('你好'));
    expect(await nextRun.get('Hello', 'en', 'gpt-4o-mini')).toBeNull();
  });

  it('clears content-indexed entries when the page run is disposed', async () => {
    const mem = makeMemory();
    const doc = makeDocument('<p id="x">Hello</p>');
    const el = doc.querySelector('#x') as HTMLElement;
    await mem.put('Hello', 'en', 'gpt-4o-mini', makeBlock('你好'));
    await mem.put('Hello', 'en', 'gpt-4o-mini', makeBlock('你好'), el);
    mem.dispose();
    expect(mem.l2Size).toBe(0);
    expect(await mem.get('Hello', 'en', 'gpt-4o-mini')).toBeNull();
    expect(await mem.get('Hello', 'en', 'gpt-4o-mini', el)).toBeNull();
  });
});
