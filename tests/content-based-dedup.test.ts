import { describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';
import { renderTranslations, removeRenderedTranslations } from '@/src/translator/render-translations';
import { SOURCE_CLASS, TRANSLATION_CLASS } from '@/src/translator/page-status';
import { bindCachedTranslation } from '@/src/translator/translation-memory';
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

describe('identical-text rendering (SPA shell safety)', () => {
  it('renders every real sibling link with identical source text', () => {
    // Identical labels do not prove that two DOM nodes are duplicate
    // framework output. A user must still get a translation beside every
    // visible link; model-result reuse belongs to TranslationMemory, not
    // to the renderer's DOM insertion policy.
    const { root } = makeFragment(
      '<header>' +
        '<nav><ul>' +
        '<li><a class="nav1">首页</a></li>' +
        '<li><a class="nav2">首页</a></li>' +
        '</ul></nav>' +
        '</header>',
    );
    const a = root.querySelector('.nav1') as HTMLElement;
    const b = root.querySelector('.nav2') as HTMLElement;
    const cachedResult = translated('previous-dom-id', 'Home');
    renderTranslations(
      [block(a, 'b1', '首页'), block(b, 'b2', '首页')],
      [
        bindCachedTranslation(cachedResult, 'b1'),
        bindCachedTranslation(cachedResult, 'b2'),
      ],
      'en',
    );
    expect(a.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(1);
    expect(b.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(1);
    expect(a.querySelector(`.${TRANSLATION_CLASS}`)?.textContent).toBe('Home');
    expect(b.querySelector(`.${TRANSLATION_CLASS}`)?.textContent).toBe('Home');
  });

  it('does not deduplicate siblings with different text under the same parent', () => {
    const { root } = makeFragment(
      '<header>' +
        '<nav>' +
        '<a class="home">首页</a>' +
        '<a class="api">API文档</a>' +
        '</nav>' +
        '</header>',
    );
    const home = root.querySelector('.home') as HTMLElement;
    const api = root.querySelector('.api') as HTMLElement;
    renderTranslations(
      [block(home, 'b1', '首页'), block(api, 'b2', 'API文档')],
      [translated('b1', 'Home'), translated('b2', 'API Documentation')],
      'en',
    );
    expect(home.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(1);
    expect(api.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(1);
  });

  it('clears every identical-text translation without changing source text', () => {
    const { root } = makeFragment(
      '<header>' +
        '<a class="d1">首页</a>' +
        '<a class="d2">首页</a>' +
        '<a class="d3">首页</a>' +
        '<a class="d4">首页</a>' +
        '</header>',
    );
    const links = Array.from(root.querySelectorAll('a'));
    renderTranslations(
      links.map((el, i) => block(el, `b${i}`, '首页')),
      links.map((_, i) => translated(`b${i}`, 'Home')),
      'en',
    );
    expect(root.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(4);
    removeRenderedTranslations(root);
    expect(root.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(0);
    expect(root.querySelectorAll(`.${SOURCE_CLASS}`).length).toBe(0);
    expect(links.map((link) => link.textContent)).toEqual(['首页', '首页', '首页', '首页']);
  });
});
