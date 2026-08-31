import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseHTML } from 'linkedom';
import {
  insertTranslation,
  removeInsertedTranslation,
  isHighlightApiAvailable,
  type InsertStrategy,
} from '@/src/translator/insert-strategies';
import {
  removeRenderedTranslations,
  renderTranslations,
} from '@/src/translator/render-translations';

function makeFragment(html: string): { root: HTMLElement; document: Document } {
  const doc = parseHTML('<main>' + html + '</main>').document as unknown as Document;
  return { root: doc.querySelector('main') as unknown as HTMLElement, document: doc };
}

describe('insertTranslation (Layer 6)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it('restores multiple text nodes, comments, and the original lang after range-replace', () => {
    const { root, document: doc } = makeFragment('<p id="t4b" lang="en-US">Hello</p>');
    const el = root.querySelector('#t4b') as HTMLElement;
    const first = el.firstChild as Node;
    const comment = doc.createComment('keep this node');
    const second = doc.createTextNode(' world');
    el.replaceChildren(first, comment, second);

    insertTranslation(el, '你好', 'zh-CN', 'range-replace');
    expect(el.textContent).toBe('你好');
    removeInsertedTranslation(el, 'range-replace');

    expect(el.childNodes).toHaveLength(3);
    expect(el.childNodes[0]).toBe(first);
    expect(el.childNodes[1]).toBe(comment);
    expect(el.childNodes[2]).toBe(second);
    expect(el.textContent).toBe('Hello world');
    expect(el.getAttribute('lang')).toBe('en-US');
  });

  it('removes one source from an aggregate CSS Highlight without clearing its sibling', () => {
    class FakeHighlight {
      readonly ranges: Range[];

      constructor(...ranges: Range[]) {
        this.ranges = ranges;
      }
    }
    const highlights = new Map<string, FakeHighlight>();
    vi.stubGlobal('Highlight', FakeHighlight);
    vi.stubGlobal('CSS', { highlights });

    const { root } = makeFragment('<p id="one">One</p><p id="two">Two</p>');
    const first = root.querySelector('#one') as HTMLElement;
    const second = root.querySelector('#two') as HTMLElement;
    insertTranslation(first, '一', 'zh-CN', 'highlight');
    insertTranslation(second, '二', 'zh-CN', 'highlight');

    const aggregate = highlights.get('textduet-translation');
    expect(aggregate?.ranges).toHaveLength(2);
    expect(first.hasAttribute('data-td-highlight-text')).toBe(true);
    expect(second.hasAttribute('data-td-highlight-text')).toBe(true);

    removeInsertedTranslation(first, 'highlight');
    const afterFirstRemoval = highlights.get('textduet-translation');
    expect(afterFirstRemoval?.ranges).toHaveLength(1);
    expect(first.hasAttribute('data-td-highlight-text')).toBe(false);
    expect(second.getAttribute('data-td-highlight-text')).toBe('二');

    removeInsertedTranslation(second, 'highlight');
    expect(highlights.has('textduet-translation')).toBe(false);
    expect(second.hasAttribute('data-td-highlight-text')).toBe(false);
  });

  it('keeps the visible adjacent translation and excludes it from the highlight range', async () => {
    class FakeHighlight {
      readonly ranges: Range[];

      constructor(...ranges: Range[]) {
        this.ranges = ranges;
      }
    }
    const highlights = new Map<string, FakeHighlight>();
    vi.stubGlobal('Highlight', FakeHighlight);
    vi.stubGlobal('CSS', { highlights });

    const { root } = makeFragment('<p id="visible">Hello</p>');
    const element = root.querySelector('#visible') as HTMLElement;
    renderTranslations(
      [{ id: 'visible-id', text: 'Hello', element }],
      [{ id: 'visible-id', translatedText: '你好' }],
      'zh-CN',
      { useHighlight: true },
    );

    const translation = element.querySelector('.textduet-translation');
    expect(translation?.textContent).toBe('你好');
    expect(element.querySelector('.textduet-source')?.textContent).toBe('Hello');
    const aggregate = highlights.get('textduet-translation');
    expect(aggregate?.ranges).toHaveLength(1);
    expect(aggregate?.ranges[0]).toBeDefined();
  });

  it('cleans a root element and removes an old Highlight when switching back to adjacent', () => {
    class FakeHighlight {
      readonly ranges: Range[];

      constructor(...ranges: Range[]) {
        this.ranges = ranges;
      }
    }
    const highlights = new Map<string, FakeHighlight>();
    vi.stubGlobal('Highlight', FakeHighlight);
    vi.stubGlobal('CSS', { highlights });

    const { root } = makeFragment('<p id="switch">Switch me</p>');
    const element = root.querySelector('#switch') as HTMLElement;
    const candidate = [{ id: 'switch-id', text: 'Switch me', element }];
    const translation = [{ id: 'switch-id', translatedText: '切换' }];
    renderTranslations(candidate, translation, 'zh-CN', { useHighlight: true });
    expect(highlights.has('textduet-translation')).toBe(true);
    expect(element.querySelectorAll('.textduet-translation')).toHaveLength(1);

    renderTranslations(candidate, translation, 'zh-CN');
    expect(highlights.has('textduet-translation')).toBe(false);
    expect(element.querySelectorAll('.textduet-translation')).toHaveLength(1);
    expect(element.hasAttribute('data-td-highlight-text')).toBe(false);

    // `element` itself is a valid cleanup root, not only a document/ancestor.
    renderTranslations(candidate, translation, 'zh-CN', { useHighlight: true });
    removeRenderedTranslations(element);
    expect(element.querySelector('.textduet-translation')).toBeNull();
    expect(element.hasAttribute('data-td-highlight-text')).toBe(false);
    expect(highlights.has('textduet-translation')).toBe(false);
  });

  it('clears a failed Highlight registration so a later attempt can retry', () => {
    class ThrowingHighlight {
      constructor(..._ranges: Range[]) {
        throw new Error('unsupported range');
      }
    }
    const highlights = new Map<string, ThrowingHighlight>();
    vi.stubGlobal('Highlight', ThrowingHighlight);
    vi.stubGlobal('CSS', { highlights });

    const { root } = makeFragment('<p id="retry">Retry me</p>');
    const element = root.querySelector('#retry') as HTMLElement;
    const first = insertTranslation(element, '重试', 'zh-CN', 'highlight');
    expect(first.applied).toBe('adjacent');
    expect(element.hasAttribute('data-td-highlight-text')).toBe(false);
    expect(highlights.has('textduet-translation')).toBe(false);
  });

  it('preserves an existing sibling highlight when a newly added range fails', () => {
    let constructionCount = 0;
    class SelectiveHighlight {
      readonly ranges: Range[];

      constructor(...ranges: Range[]) {
        constructionCount += 1;
        // The first source is valid; any aggregate containing two ranges is
        // rejected to model a host implementation that cannot combine a
        // newly detached/invalid range with an existing one.
        if (ranges.length > 1) throw new Error('invalid aggregate');
        this.ranges = ranges;
      }
    }
    const highlights = new Map<string, SelectiveHighlight>();
    vi.stubGlobal('Highlight', SelectiveHighlight);
    vi.stubGlobal('CSS', { highlights });

    const { root } = makeFragment('<p id="one">One</p><p id="two">Two</p>');
    const first = root.querySelector('#one') as HTMLElement;
    const second = root.querySelector('#two') as HTMLElement;
    expect(insertTranslation(first, '一', 'zh-CN', 'highlight').applied).toBe('highlight');
    expect(insertTranslation(second, '二', 'zh-CN', 'highlight').applied).toBe('adjacent');
    expect(first.hasAttribute('data-td-highlight-text')).toBe(true);
    expect(second.hasAttribute('data-td-highlight-text')).toBe(false);
    expect(highlights.get('textduet-translation')?.ranges).toHaveLength(1);
    expect(constructionCount).toBeGreaterThanOrEqual(3);
  });

  it('restores range replacement before switching to highlight', () => {
    class FakeHighlight {
      readonly ranges: Range[];

      constructor(...ranges: Range[]) {
        this.ranges = ranges;
      }
    }
    const highlights = new Map<string, FakeHighlight>();
    vi.stubGlobal('Highlight', FakeHighlight);
    vi.stubGlobal('CSS', { highlights });

    const { root } = makeFragment('<p id="multi">Hello <!--split-->world</p>');
    const element = root.querySelector('#multi') as HTMLElement;
    const originalNodes = [...element.childNodes];
    expect(insertTranslation(element, '你好', 'zh-CN', 'range-replace').applied).toBe('range-replace');
    expect(element.textContent).toBe('你好');
    expect(insertTranslation(element, '你好', 'zh-CN', 'highlight').applied).toBe('highlight');
    expect(element.textContent).toBe('Hello world');
    expect(element.hasAttribute('data-td-original-text')).toBe(false);
    expect(element.childNodes).toHaveLength(3);
    expect([...element.childNodes]).toEqual(originalNodes);
    expect(element.childNodes[1]?.nodeType).toBe(8);
    expect(highlights.get('textduet-translation')?.ranges).toHaveLength(2);
  });

  it('registers every page-owned text node while excluding nested translations', () => {
    class FakeHighlight {
      readonly ranges: Range[];

      constructor(...ranges: Range[]) {
        this.ranges = ranges;
      }
    }
    const highlights = new Map<string, FakeHighlight>();
    vi.stubGlobal('Highlight', FakeHighlight);
    vi.stubGlobal('CSS', { highlights });

    const { root, document: doc } = makeFragment('<p id="multi"></p>');
    const element = root.querySelector('#multi') as HTMLElement;
    element.append(doc.createTextNode('Hello '), doc.createTextNode('world'));
    insertTranslation(element, '你好 世界', 'zh-CN', 'highlight');
    expect(highlights.get('textduet-translation')?.ranges).toHaveLength(2);
  });

  it('clears a prior source highlight when the source becomes empty', () => {
    class FakeHighlight {
      readonly ranges: Range[];

      constructor(...ranges: Range[]) {
        this.ranges = ranges;
      }
    }
    const highlights = new Map<string, FakeHighlight>();
    vi.stubGlobal('Highlight', FakeHighlight);
    vi.stubGlobal('CSS', { highlights });

    const { root } = makeFragment('<p id="empty">Text</p>');
    const element = root.querySelector('#empty') as HTMLElement;
    insertTranslation(element, '文本', 'zh-CN', 'highlight');
    expect(highlights.has('textduet-translation')).toBe(true);
    element.replaceChildren();
    const result = insertTranslation(element, '文本', 'zh-CN', 'highlight');
    expect(result.applied).toBe('adjacent');
    expect(highlights.has('textduet-translation')).toBe(false);
    expect(element.hasAttribute('data-td-highlight-text')).toBe(false);
  });

  it('falls back for a source element that is itself an interactive control', () => {
    const { root } = makeFragment('<p id="role" role="button">Activate</p>');
    const element = root.querySelector('#role') as HTMLElement;
    const result = insertTranslation(element, '激活', 'zh-CN', 'range-replace');
    expect(result.applied).toBe('adjacent');
    expect(element.textContent).toBe('Activate');
    expect(element.hasAttribute('data-td-original-text')).toBe(false);
  });
});
