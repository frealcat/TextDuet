/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';
import { collectTranslationCandidates } from '@/src/translator/dom-extraction';
import {
  reconcileRenderedTranslation,
  renderTranslations,
  TRANSLATION_OWNER_ATTRIBUTE,
} from '@/src/translator/render-translations';
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

/** Mirrors the entrypoint's stable element-id + source-text caches. */
function createRescanCollector(
  initialBlocks: Array<TranslationBlock & { element: HTMLElement }>,
): (document: Document) => Array<TranslationBlock & { element: HTMLElement }> {
  const idsByElement = new WeakMap<HTMLElement, string>();
  const sourceTextByElement = new WeakMap<HTMLElement, string>();
  let nextId = 0;

  for (const initial of initialBlocks) {
    idsByElement.set(initial.element, initial.id);
    sourceTextByElement.set(initial.element, initial.text);
  }

  return (document) => collectTranslationCandidates(document, {
    getId: (element) => {
      const existing = idsByElement.get(element);
      if (existing) return existing;
      const id = `rescan-${nextId++}`;
      idsByElement.set(element, id);
      return id;
    },
    getText: (element) => {
      const existing = sourceTextByElement.get(element);
      if (existing !== undefined) return existing;
      const text = element.textContent || '';
      sourceTextByElement.set(element, text);
      return text;
    },
    isVisible: () => true,
  });
}

function wrapChildrenAsSpaWould(element: HTMLElement, document: Document): void {
  const wrapper = document.createElement('span');
  // This is deliberately a page-owned generic wrapper, not a TextDuet
  // marker. Framework hydration often introduces exactly this shape.
  wrapper.className = 'spa-hydration-wrapper';
  while (element.firstChild) wrapper.append(element.firstChild);
  element.append(wrapper);
}

describe('TD-2026-029: active/inactive reconciliation must not retranslate TextDuet DOM', () => {
  it('keeps only the original source candidates and reuses one owned translation across resume scans', () => {
    // This is the production path behind an active → inactive → active
    // cycle: the first pass renders the page, a SPA may re-wrap children
    // while hidden, then the visible reconciliation collects candidates
    // again. Before this regression fix, generic `span` collection selected
    // `.textduet-source` and `.textduet-translation` themselves, then
    // recursively translated the translation span on every resume.
    const { root, document: doc } = makeFragment(`
      <h1>全部话题</h1>
      <p>欢迎来到 大健康圈内人的「AI游乐场」</p>
    `);
    const h1 = root.querySelector('h1') as HTMLElement;
    const p = root.querySelector('p') as HTMLElement;
    const sourceBlocks = [
      block(h1, 'b1', '全部话题'),
      block(p, 'b2', '欢迎来到 大健康圈内人的「AI游乐场」'),
    ];
    const translations = [
      translated('b1', 'All Topics'),
      translated('b2', 'Welcome to the AI Playground inside the health circle'),
    ];
    const collectOnResume = createRescanCollector(sourceBlocks);

    renderTranslations(sourceBlocks, translations, 'en');
    const firstH1Translation = h1.querySelector<HTMLElement>(`.${TRANSLATION_CLASS}`);
    const firstPTranslation = p.querySelector<HTMLElement>(`.${TRANSLATION_CLASS}`);
    expect(firstH1Translation).not.toBeNull();
    expect(firstPTranslation).not.toBeNull();
    expect(firstH1Translation?.getAttribute(TRANSLATION_OWNER_ATTRIBUTE)).toBe('b1');
    expect(firstPTranslation?.getAttribute(TRANSLATION_OWNER_ATTRIBUTE)).toBe('b2');

    for (let cycle = 0; cycle < 3; cycle += 1) {
      // A common SPA focus/hydration behavior: children are adopted into a
      // new wrapper while the source element itself is retained.
      wrapChildrenAsSpaWould(h1, doc);
      wrapChildrenAsSpaWould(p, doc);

      const candidates = collectOnResume(doc);
      expect(candidates).toHaveLength(2);
      expect(candidates.map(({ element }) => element)).toEqual([h1, p]);
      expect(candidates.map(({ id }) => id)).toEqual(['b1', 'b2']);
      expect(candidates.map(({ text }) => text)).toEqual([
        '全部话题',
        '欢迎来到 大健康圈内人的「AI游乐场」',
      ]);
      expect(candidates.some(({ element }) => element.matches(
        `.${SOURCE_CLASS}, .${TRANSLATION_CLASS}`,
      ))).toBe(false);

      // `processLoadedContent` performs this reconciliation before deciding
      // whether a model call is needed. Same-language spans are reused and
      // restored to a direct child, not sent through another translation pass.
      for (const candidate of candidates) {
        const existing = reconcileRenderedTranslation(candidate.element, candidate.id);
        expect(existing?.lang).toBe('en');
      }

      expect(h1.querySelectorAll(`.${TRANSLATION_CLASS}`)).toHaveLength(1);
      expect(p.querySelectorAll(`.${TRANSLATION_CLASS}`)).toHaveLength(1);
      expect(h1.querySelector(`:scope > .${TRANSLATION_CLASS}`)).toBe(firstH1Translation);
      expect(p.querySelector(`:scope > .${TRANSLATION_CLASS}`)).toBe(firstPTranslation);
    }
  });

  it('does not mistake or delete a real child block translation for its parent', () => {
    // Ownership is element-id based, never text or arbitrary descendant
    // matching. This protects the project-wide "zero missed translations"
    // contract when a real nested candidate is independently translated.
    const { root } = makeFragment('<div id="parent"><p id="child">Hello</p></div>');
    const parent = root.querySelector('#parent') as HTMLElement;
    const child = root.querySelector('#child') as HTMLElement;

    renderTranslations([block(child, 'child-id', 'Hello')], [translated('child-id', '你好')], 'zh-CN');
    const childTranslation = child.querySelector<HTMLElement>(`.${TRANSLATION_CLASS}`);
    expect(childTranslation).not.toBeNull();

    expect(reconcileRenderedTranslation(parent, 'parent-id')).toBeNull();
    expect(child.querySelector(`.${TRANSLATION_CLASS}`)).toBe(childTranslation);
    expect(childTranslation?.getAttribute(TRANSLATION_OWNER_ATTRIBUTE)).toBe('child-id');
  });

  it('adopts a legacy ownerless translation through a generic SPA wrapper', () => {
    // Existing pages can retain spans inserted by the previous release while
    // the extension updates. They have the source block marker but no span
    // owner marker yet; one reconciliation must adopt the existing node,
    // rather than append a second translation beside it.
    const { root, document: doc } = makeFragment('<h1>全部话题</h1>');
    const h1 = root.querySelector('h1') as HTMLElement;
    const sourceBlock = block(h1, 'b1', '全部话题');
    const collectOnResume = createRescanCollector([sourceBlock]);

    renderTranslations([sourceBlock], [translated('b1', 'All Topics')], 'en');
    const legacyTranslation = h1.querySelector<HTMLElement>(`.${TRANSLATION_CLASS}`);
    expect(legacyTranslation).not.toBeNull();
    legacyTranslation?.removeAttribute(TRANSLATION_OWNER_ATTRIBUTE);
    wrapChildrenAsSpaWould(h1, doc);

    const [candidate] = collectOnResume(doc);
    expect(candidate?.element).toBe(h1);
    const reconciled = reconcileRenderedTranslation(h1, 'b1');
    expect(reconciled).toBe(legacyTranslation);
    expect(reconciled?.parentElement).toBe(h1);
    expect(reconciled?.getAttribute(TRANSLATION_OWNER_ATTRIBUTE)).toBe('b1');
    expect(h1.querySelectorAll(`.${TRANSLATION_CLASS}`)).toHaveLength(1);
  });

  it('keeps the marked source candidate while dynamic cleanup temporarily removes its translation', () => {
    const { root, document: doc } = makeFragment('<h1>全部话题</h1>');
    const h1 = root.querySelector('h1') as HTMLElement;
    const sourceBlock = block(h1, 'b1', '全部话题');
    const collectOnResume = createRescanCollector([sourceBlock]);

    renderTranslations([sourceBlock], [translated('b1', 'All Topics')], 'en');
    wrapChildrenAsSpaWould(h1, doc);
    h1.querySelector(`.${TRANSLATION_CLASS}`)?.remove();

    const candidates = collectOnResume(doc);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.element).toBe(h1);
    expect(candidates[0]?.id).toBe('b1');
    expect(candidates[0]?.text).toBe('全部话题');
  });
});
