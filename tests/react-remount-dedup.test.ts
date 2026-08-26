import { describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';
import { renderTranslations, removeRenderedTranslations } from '@/src/translator/render-translations';
import { SOURCE_CLASS, TRANSLATION_CLASS } from '@/src/translator/page-status';
import type { TranslatedBlock, TranslationBlock } from '@/src/core/contracts';

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

describe('React reconciliation dedup (Layer 2 / Layer 7 boundary cases)', () => {
  it('in-place text patch: same element, textContent overwritten, fresh translation span', () => {
    // React typically overwrites textContent during a re-render, which
    // destroys all children including the old translation span. The
    // dedup cannot magically preserve a span that no longer exists;
    // it correctly creates a fresh one for the new text.
    const { root } = makeFragment('<p id="p">Hello</p>');
    const el = root.querySelector('#p') as HTMLElement;
    renderTranslations([block(el, 'b1', 'Hello')], [translated('b1', '你好')], 'en');
    expect(el.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(1);
    const firstSpan = el.querySelector(`.${TRANSLATION_CLASS}`);
    // React re-renders: same node, textContent changes. This wipes
    // the previous children (including the .td-translation span).
    el.textContent = 'World';
    expect(el.querySelector(`.${TRANSLATION_CLASS}`)).toBeNull();
    // Re-translate. The dedup sees no surviving translation span, so
    // it creates a fresh one — and only one, never two.
    renderTranslations([block(el, 'b1', 'World')], [translated('b1', '世界')], 'en');
    expect(el.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(1);
    expect(el.querySelector(`.${TRANSLATION_CLASS}`)).not.toBe(firstSpan);
    expect(el.querySelector(`.${TRANSLATION_CLASS}`)?.textContent).toBe('世界');
  });

  it('re-translating the same unchanged text never duplicates the span', () => {
    // SPA refetch: React keeps the element node and updates the model
    // answer. The dedup must return the existing translation span
    // and only refresh its textContent, not append a new one.
    const { root } = makeFragment('<p id="p">Hello</p>');
    const el = root.querySelector('#p') as HTMLElement;
    renderTranslations([block(el, 'b1', 'Hello')], [translated('b1', '你好')], 'en');
    const firstSpan = el.querySelector(`.${TRANSLATION_CLASS}`);
    // Second pass: same element, same text, same block id.
    renderTranslations([block(el, 'b1', 'Hello')], [translated('b1', '你好')], 'en');
    expect(el.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(1);
    expect(el.querySelector(`.${TRANSLATION_CLASS}`)).toBe(firstSpan);
  });

  it('element replacement: old element + translation gone, new element gets fresh translation', () => {
    const { root, document: doc } = makeFragment('<div id="host"><p id="old">Hello</p></div>');
    const host = root.querySelector('#host') as HTMLElement;
    const oldEl = host.querySelector('#old') as HTMLElement;
    renderTranslations([block(oldEl, 'b1', 'Hello')], [translated('b1', '你好')], 'en');
    expect(oldEl.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(1);
    // React re-mounts: replace the old <p> with a fresh one (same id,
    // same text, but a new DOM node). The old element + its
    // translation span are gone from the document.
    const newEl = doc.createElement('p');
    newEl.id = 'old';
    newEl.textContent = 'Hello';
    host.replaceChild(newEl, oldEl);
    expect(root.querySelector(`.${TRANSLATION_CLASS}`)).toBeNull();
    // Re-translate the new element. The dedup should not find the
    // old (detached) translation span, so a fresh span is created.
    renderTranslations([block(newEl, 'b1', 'Hello')], [translated('b1', '你好')], 'en');
    expect(newEl.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(1);
    expect(newEl.querySelector(`.${TRANSLATION_CLASS}`)?.textContent).toBe('你好');
  });

  it('two elements with same text and same id get independent translations', () => {
    const { root } = makeFragment(
      '<div><p id="dup">Hello</p><p id="dup">World</p></div>',
    );
    const paragraphs = root.querySelectorAll('p');
    expect(paragraphs.length).toBe(2);
    // React duplicates the key: two physically distinct DOM nodes
    // with the same id (a bug we still want to be resilient to).
    renderTranslations(
      [block(paragraphs[0]!, 'b1', 'Hello'), block(paragraphs[1]!, 'b2', 'World')],
      [translated('b1', '你好'), translated('b2', '世界')],
      'en',
    );
    expect(paragraphs[0]!.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(1);
    expect(paragraphs[1]!.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(1);
    expect(paragraphs[0]!.querySelector(`.${TRANSLATION_CLASS}`)?.textContent).toBe('你好');
    expect(paragraphs[1]!.querySelector(`.${TRANSLATION_CLASS}`)?.textContent).toBe('世界');
  });

  it('removeRenderedTranslations wipes both wrappers and translations in one pass', () => {
    const { root } = makeFragment(
      '<div><p id="a">A</p><p id="b">B</p></div>',
    );
    const a = root.querySelector('#a') as HTMLElement;
    const b = root.querySelector('#b') as HTMLElement;
    renderTranslations(
      [block(a, 'b1', 'A'), block(b, 'b2', 'B')],
      [translated('b1', '甲'), translated('b2', '乙')],
      'en',
    );
    expect(root.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(2);
    expect(root.querySelectorAll(`.${SOURCE_CLASS}`).length).toBe(2);
    removeRenderedTranslations(root);
    expect(root.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(0);
    expect(root.querySelectorAll(`.${SOURCE_CLASS}`).length).toBe(0);
    // Source text is preserved in the parent after unwrap.
    expect(a.textContent).toBe('A');
    expect(b.textContent).toBe('B');
  });
});
