import { describe, expect, it, beforeEach } from 'vitest';
import { parseHTML } from 'linkedom';
import { renderTranslations, removeRenderedTranslations } from '@/src/translator/render-translations';
import { SOURCE_CLASS, TRANSLATION_CLASS } from '@/src/translator/page-status';
import type { TranslatedBlock, TranslationBlock } from '@/src/core/contracts';

const { document: linkedomDocument } = parseHTML('<!doctype html><html></html>');

function makeFragment(html: string): { root: HTMLElement; document: Document } {
  const doc = parseHTML('<main>' + html + '</main>').document as unknown as Document;
  return { root: doc.querySelector('main') as unknown as HTMLElement, document: doc };
}

function makeBlock(element: HTMLElement, id: string, text: string): TranslationBlock & { element: HTMLElement } {
  return {
    id,
    text,
    element,
  };
}

describe('render-translations dedup (SPA re-render safety)', () => {
  beforeEach(() => {
    removeRenderedTranslations(linkedomDocument as unknown as ParentNode);
  });

  it('inserts exactly one translation per source element on first render', () => {
    const { root, document: doc } = makeFragment('<h1>全部话题</h1>');
    const h1 = root.querySelector('h1') as HTMLElement;
    renderTranslations(
      [makeBlock(h1, 'b1', '全部话题')],
      [{ id: 'b1', translatedText: 'All Topics' }],
      'en',
    );
    expect(h1.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(1);
  });

  it('does not stack a duplicate when the SPA wraps the previous translation in a new node', () => {
    // Scenario: after the first render, the source element has a source
    // wrapper and a direct-child translation span. A SPA re-render
    // (e.g. Next.js App Router) replaces the wrapper but the previous
    // translation is now under a deeper descendant. A second render
    // call must NOT add another translation span.
    const { root, document: doc } = makeFragment('<h1>全部话题</h1>');
    const h1 = root.querySelector('h1') as HTMLElement;
    renderTranslations(
      [makeBlock(h1, 'b1', '全部话题')],
      [{ id: 'b1', translatedText: 'All Topics' }],
      'en',
    );
    expect(h1.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(1);

    // Simulate the SPA framework re-wrapping the children. The
    // translation is no longer a direct child of <h1>.
    const newWrapper = doc.createElement('span');
    newWrapper.className = SOURCE_CLASS;
    while (h1.firstChild) newWrapper.append(h1.firstChild);
    h1.append(newWrapper);
    expect(h1.querySelectorAll(`:scope > .${TRANSLATION_CLASS}`).length).toBe(0);
    expect(h1.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(1);

    // Re-render: the old translation must be reused, not duplicated.
    renderTranslations(
      [makeBlock(h1, 'b1', '全部话题')],
      [{ id: 'b1', translatedText: 'All Topics' }],
      'en',
    );
    expect(h1.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(1);
  });

  it('removes any stale sibling translations that were left behind by previous runs', () => {
    // Simulate the case where the source element somehow ends up with
    // multiple .td-translation descendants (e.g. two separate runs
    // before the SPA fully cleaned up). The next render must collapse
    // them down to exactly one.
    const { root, document: doc } = makeFragment('<h1>全部话题</h1>');
    const h1 = root.querySelector('h1') as HTMLElement;
    const stale1 = doc.createElement('span');
    stale1.className = TRANSLATION_CLASS;
    stale1.textContent = 'stale-1';
    h1.append(stale1);
    const stale2 = doc.createElement('span');
    stale2.className = TRANSLATION_CLASS;
    stale2.textContent = 'stale-2';
    h1.append(stale2);
    expect(h1.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(2);

    renderTranslations(
      [makeBlock(h1, 'b1', '全部话题')],
      [{ id: 'b1', translatedText: 'All Topics' }],
      'en',
    );
    const translations = h1.querySelectorAll(`.${TRANSLATION_CLASS}`);
    expect(translations.length).toBe(1);
    expect(translations[0]?.textContent).toBe('All Topics');
  });

  it('handles multiple independent elements without bleeding translations', () => {
    const { root, document: doc } = makeFragment(`
      <main>
        <h1>全部话题</h1>
        <p>欢迎来到 大健康圈内人的「AI游乐场」</p>
      </main>
    `);
    const h1 = root.querySelector('h1') as HTMLElement;
    const p = root.querySelector('p') as HTMLElement;
    renderTranslations(
      [
        makeBlock(h1, 'b1', '全部话题'),
        makeBlock(p, 'b2', '欢迎来到 大健康圈内人的「AI游乐场」'),
      ],
      [
        { id: 'b1', translatedText: 'All Topics' },
        { id: 'b2', translatedText: 'Welcome to the AI Playground inside the health circle' },
      ],
      'en',
    );
    expect(h1.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(1);
    expect(p.querySelectorAll(`.${TRANSLATION_CLASS}`).length).toBe(1);
    expect(h1.querySelector(`.${TRANSLATION_CLASS}`)?.textContent).toBe('All Topics');
    expect(p.querySelector(`.${TRANSLATION_CLASS}`)?.textContent).toBe('Welcome to the AI Playground inside the health circle');
  });
});
