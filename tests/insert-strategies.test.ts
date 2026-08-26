import { describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';
import {
  insertTranslation,
  removeInsertedTranslation,
  isHighlightApiAvailable,
  type InsertStrategy,
} from '@/src/translator/insert-strategies';

function makeFragment(html: string): { root: HTMLElement; document: Document } {
  const doc = parseHTML('<main>' + html + '</main>').document as unknown as Document;
  return { root: doc.querySelector('main') as unknown as HTMLElement, document: doc };
}

describe('insertTranslation (Layer 6)', () => {
  it('exposes the CSS.highlights availability check without throwing', () => {
    expect(typeof isHighlightApiAvailable()).toBe('boolean');
  });

  it('adjacent is the default strategy and is a no-op wrapper for render-translations', () => {
    const { root } = makeFragment('<p id="t">Hello</p>');
    const el = root.querySelector('#t') as HTMLElement;
    const result = insertTranslation(el, '你好', 'zh-CN');
    expect(result.applied).toBe('adjacent');
    // The actual DOM mutation is owned by render-translations.ts.
    expect(el.querySelector('span')).toBeNull();
  });

  it('range-replace stores the original text and replaces it with the translation', () => {
    const { root } = makeFragment('<p id="t2">Hello</p>');
    const el = root.querySelector('#t2') as HTMLElement;
    const result = insertTranslation(el, '你好', 'zh-CN', 'range-replace');
    expect(result.applied).toBe('range-replace');
    expect(el.textContent).toBe('你好');
    expect(el.getAttribute('data-td-original-text')).toBe('Hello');
    expect(el.getAttribute('lang')).toBe('zh-CN');
  });

  it('range-replace falls back to adjacent when the source contains interactive controls', () => {
    const { root } = makeFragment(
      '<p id="t3">Click <a href="/x">here</a> now</p>',
    );
    const el = root.querySelector('#t3') as HTMLElement;
    const result = insertTranslation(el, '点 这里 现在', 'zh-CN', 'range-replace');
    expect(result.applied).toBe('adjacent');
    // Original text is preserved (no replacement happened).
    expect(el.textContent).toBe('Click here now');
  });

  it('removeInsertedTranslation restores the original text after range-replace', () => {
    const { root } = makeFragment('<p id="t4">Hello</p>');
    const el = root.querySelector('#t4') as HTMLElement;
    insertTranslation(el, '你好', 'zh-CN', 'range-replace');
    expect(el.textContent).toBe('你好');
    removeInsertedTranslation(el, 'range-replace' as InsertStrategy);
    expect(el.textContent).toBe('Hello');
    expect(el.hasAttribute('data-td-original-text')).toBe(false);
  });
});
