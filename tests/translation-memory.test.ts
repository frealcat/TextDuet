import { describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';
import {
  bindCachedTranslation,
  TranslationMemory,
  type BroadcastChannelLike,
} from '@/src/translator/translation-memory';
import type { TranslatedBlock } from '@/src/core/contracts';

function makeDocument(html: string): Document {
  return parseHTML('<main>' + html + '</main>').document as unknown as Document;
}

function makeBlock(text: string): TranslatedBlock {
  return { id: 'b1', translatedText: text };
}

interface FakeChannel extends BroadcastChannelLike {
  sent: unknown[];
  listeners: Set<(event: MessageEvent) => void>;
}

function makeFakeChannel(): FakeChannel {
  const listeners = new Set<(event: MessageEvent) => void>();
  const sent: unknown[] = [];
  const api: FakeChannel = {
    sent,
    listeners,
    postMessage(message) {
      sent.push(message);
    },
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
    close() {
      listeners.clear();
    },
  };
  return api;
}

function makeMemory(): TranslationMemory {
  return new TranslationMemory({
    disableBroadcastChannel: true,
    storageBackend: null,
  });
}

describe('TranslationMemory (Layer 5)', () => {
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

  it('broadcasts put events on the supplied channel so peers can hydrate L2', async () => {
    const channel = makeFakeChannel();
    const mem = new TranslationMemory({
      disableBroadcastChannel: false,
      storageBackend: null,
      channelFactory: () => channel,
    });
    try {
      await mem.put('Hello', 'en', 'gpt-4o-mini', makeBlock('你好'));
      expect(channel.sent.length).toBe(1);
      const payload = channel.sent[0] as { type: string; hash: string; block: TranslatedBlock };
      expect(payload.type).toBe('put');
      expect(payload.block.translatedText).toBe('你好');
    } finally {
      mem.dispose();
    }
  });

  it('dispose removes channel listeners and closes the channel', () => {
    const channel = makeFakeChannel();
    const mem = new TranslationMemory({
      disableBroadcastChannel: false,
      storageBackend: null,
      channelFactory: () => channel,
    });
    mem.dispose();
    expect(channel.listeners.size).toBe(0);
  });
});
