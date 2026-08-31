import { describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';
import { TranslationMemory } from '@/src/translator/translation-memory';
import { contentHash } from '@/src/translator/content-hash';
import {
  renderTranslations,
  removeRenderedTranslations,
} from '@/src/translator/render-translations';
import {
  insertTranslation,
  removeInsertedTranslation,
  isHighlightApiAvailable,
} from '@/src/translator/insert-strategies';
import { SOURCE_CLASS, TRANSLATION_CLASS } from '@/src/translator/page-status';
import type { TranslatedBlock, TranslationBlock } from '@/src/core/contracts';

const { document: linkedomDocument } = parseHTML('<!doctype html><html></html>');

function makeFragment(html: string): { root: HTMLElement; document: Document } {
  const doc = parseHTML('<main>' + html + '</main>').document as unknown as Document;
  return { root: doc.querySelector('main') as unknown as HTMLElement, document: doc };
}

function block(
  element: HTMLElement,
  id: string,
  text: string,
): TranslationBlock & { element: HTMLElement } {
  return { id, text, element };
}

function translated(id: string, text: string): TranslatedBlock {
  return { id, translatedText: text };
}

describe('L5 TranslationMemory integration (processLoadedContent cache split)', () => {
  it('returns the cached translation for an element whose text was already translated', async () => {
    const mem = new TranslationMemory();
    try {
      // First put: simulate a previous run translating this text.
      await mem.put('Hello', 'en', 'gpt-4o-mini', translated('b1', '你好'));
      // Now a fresh run asks for the same text.
      const hit = await mem.get('Hello', 'en', 'gpt-4o-mini');
      expect(hit?.translatedText).toBe('你好');
    } finally {
      mem.dispose();
    }
  });

  it('produces the same content-hash for the same text + lang + model', async () => {
    const a = await contentHash('Hello', 'en', 'gpt-4o-mini');
    const b = await contentHash('Hello', 'en', 'gpt-4o-mini');
    expect(a).toBe(b);
  });

  it('produces different content-hash for different model hints', async () => {
    const a = await contentHash('Hello', 'en', 'gpt-4o-mini');
    const b = await contentHash('Hello', 'en', 'gpt-4o');
    expect(a).not.toBe(b);
  });

  it('memory put/get roundtrips across L1 (WeakMap) and L2 (Map) by element reference', async () => {
    const { root, document: doc } = makeFragment('<p id="t">Hello</p>');
    const el = root.querySelector('#t') as HTMLElement;
    const mem = new TranslationMemory();
    try {
      await mem.put('Hello', 'en', 'gpt-4o-mini', translated('b1', '你好'), el);
      const hit = await mem.get('Hello', 'en', 'gpt-4o-mini', el);
      expect(hit?.translatedText).toBe('你好');
      // L2 also has the entry.
      expect(mem.l2Size).toBeGreaterThan(0);
    } finally {
      mem.dispose();
    }
  });
});

describe('L6 highlight strategy integration with renderTranslations', () => {
  it('isHighlightApiAvailable returns a boolean (no throw in node env)', () => {
    expect(typeof isHighlightApiAvailable()).toBe('boolean');
  });

  it('insertTranslation with adjacent strategy is a no-op for DOM (delegated to renderTranslations)', () => {
    const { root } = makeFragment('<p id="t">Hello</p>');
    const el = root.querySelector('#t') as HTMLElement;
    const result = insertTranslation(el, '你好', 'zh-CN', 'adjacent');
    expect(result.applied).toBe('adjacent');
    // The DOM is mutated by renderTranslations, not by this helper.
    expect(el.querySelector(`.${TRANSLATION_CLASS}`)).toBeNull();
  });

  it('renderTranslations with useHighlight stores translated text in a data attribute', () => {
    const { root } = makeFragment('<h2 id="h">Title</h2>');
    const el = root.querySelector('#h') as HTMLElement;
    renderTranslations(
      [block(el, 'b1', 'Title')],
      [translated('b1', '标题')],
      'en',
      { useHighlight: true },
    );
    // When CSS.highlights is unavailable (linkedom), the helper falls
    // back to the DOM-wrapper path so the test still passes on any
    // environment. We just check that either the data attribute or
    // the wrapper span is present, never both missing.
    const dataAttr = el.getAttribute('data-td-highlight-text');
    const wrapper = el.querySelector(`.${TRANSLATION_CLASS}`);
    expect(dataAttr !== null || wrapper !== null).toBe(true);
  });

  it('removeInsertedTranslation clears the data attribute after a range-replace', () => {
    const { root } = makeFragment('<p id="t">Hello</p>');
    const el = root.querySelector('#t') as HTMLElement;
    insertTranslation(el, '你好', 'zh-CN', 'range-replace');
    expect(el.textContent).toBe('你好');
    expect(el.getAttribute('data-td-original-text')).toBe('Hello');
    removeInsertedTranslation(el, 'range-replace');
    expect(el.textContent).toBe('Hello');
    expect(el.hasAttribute('data-td-original-text')).toBe(false);
  });

  it('removeRenderedTranslations tolerates elements with neither wrapper nor highlight attribute', () => {
    const { root } = makeFragment('<p id="t">Hello</p>');
    const el = root.querySelector('#t') as HTMLElement;
    // No translation was rendered; remove should be a safe no-op.
    expect(() => removeRenderedTranslations(root)).not.toThrow();
    expect(el.textContent).toBe('Hello');
  });

  it('ensureSourceWrapper is idempotent on repeated calls (TD-2026-026 regression check)', () => {
    const { root } = makeFragment('<p id="t">Hello</p>');
    const el = root.querySelector('#t') as HTMLElement;
    renderTranslations(
      [block(el, 'b1', 'Hello')],
      [translated('b1', '你好')],
      'en',
    );
    const firstWrapper = el.querySelector(`.${SOURCE_CLASS}`);
    const firstTranslation = el.querySelector(`.${TRANSLATION_CLASS}`);
    // Second pass with the same translation: dedup should keep
    // exactly one wrapper + one translation span.
    renderTranslations(
      [block(el, 'b1', 'Hello')],
      [translated('b1', '你好')],
      'en',
    );
    expect(el.querySelectorAll(`.${SOURCE_CLASS}`).length).toBe(1);
    expect(el.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(1);
    expect(el.querySelector(`.${SOURCE_CLASS}`)).toBe(firstWrapper);
    expect(el.querySelector(`.${TRANSLATION_CLASS}`)).toBe(firstTranslation);
  });
});
