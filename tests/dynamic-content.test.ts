import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseHTML } from 'linkedom';
import { collectTranslationCandidates } from '@/src/translator/dom-extraction';
import {
  clearCandidate,
  clearIneligibleManagedSources,
  isCurrentSourceText,
  observeDynamicContent,
  readTextWithoutTranslations,
} from '@/src/translator/dynamic-content';
import {
  SOURCE_BLOCK_ID_ATTRIBUTE,
  SOURCE_CLASS,
  SELECTION_ERROR_CLASS,
  SELECTION_TRANSLATION_CLASS,
  TRANSLATION_CLASS,
} from '@/src/translator/page-status';
import { insertTranslation } from '@/src/translator/insert-strategies';

const { document: linkedomDocument } = parseHTML('<!doctype html><html></html>');

function makeFragment(html: string): { root: HTMLElement; document: Document } {
  const doc = parseHTML('<main>' + html + '</main>').document as unknown as Document;
  return { root: doc.querySelector('main') as unknown as HTMLElement, document: doc };
}

describe('dynamic-content translation loop break', () => {
  it('reads source text without any nested translation spans', () => {
    const { root: candidate, document: doc } = makeFragment('<p>Original</p>');
    const source = doc.createElement('span');
    source.className = SOURCE_CLASS;
    source.textContent = 'Original';
    const translation = doc.createElement('span');
    translation.className = TRANSLATION_CLASS;
    translation.textContent = '原文';
    source.append(translation);
    candidate.replaceChildren(source);

    expect(readTextWithoutTranslations(candidate)).toBe('Original');
    expect(isCurrentSourceText(candidate, 'Original')).toBe(true);
    expect(isCurrentSourceText(candidate, 'Changed')).toBe(false);
  });

  it('excludes selected-text output from a table-cell source snapshot', () => {
    const { root: candidate, document: doc } = makeFragment('<td>Cell content</td>');
    const selectionTranslation = doc.createElement('span');
    selectionTranslation.className = SELECTION_TRANSLATION_CLASS;
    selectionTranslation.textContent = '单元格译文';
    const selectionError = doc.createElement('span');
    selectionError.className = SELECTION_ERROR_CLASS;
    selectionError.textContent = 'TextDuet：error';
    candidate.append(selectionTranslation, selectionError);

    expect(readTextWithoutTranslations(candidate)).toBe('Cell content');
    expect(isCurrentSourceText(candidate, 'Cell content')).toBe(true);
  });

  it('excludes interactive, hidden, inert, and TextDuet output from a source snapshot', () => {
    const { root: candidate, document: doc } = makeFragment(
      '<p>Readable prose <button type="button">Action label</button>'
        + '<span hidden>Private hint</span><span inert>Deferred hint</span></p>',
    );
    const translation = doc.createElement('span');
    translation.className = TRANSLATION_CLASS;
    translation.textContent = '不应回传';
    candidate.append(translation);

    const text = readTextWithoutTranslations(candidate);
    expect(text).toContain('Readable prose');
    expect(text).not.toContain('Action label');
    expect(text).not.toContain('Private hint');
    expect(text).not.toContain('Deferred hint');
    expect(text).not.toContain('不应回传');
  });

  it('keeps the translation when the candidate text has not changed (loop break)', () => {
    const { root: candidate, document: doc } = makeFragment('<h3 id="c1">Weekly update</h3>');
    const sourceText = new WeakMap<HTMLElement, string>();
    // Simulate the realistic state: the source wrapper already exists
    // and the original text is cached. The translation is appended.
    const sourceWrapper = doc.createElement('span');
    sourceWrapper.className = SOURCE_CLASS;
    sourceWrapper.innerHTML = 'Weekly update';
    candidate.append(sourceWrapper);
    sourceText.set(candidate, 'Weekly update');
    const translation = doc.createElement('span');
    translation.className = TRANSLATION_CLASS;
    translation.textContent = '本周更新';
    candidate.append(translation);

    const result = clearCandidate(candidate, sourceText);
    expect(result).toBe(false);
    expect(candidate.querySelector(`.${TRANSLATION_CLASS}`)).toBe(translation);
  });

  it('removes the translation when the candidate text has changed', () => {
    const { root: candidate, document: doc } = makeFragment('<h3 id="c2">Loading...</h3>');
    const sourceText = new WeakMap<HTMLElement, string>();
    const sourceWrapper = doc.createElement('span');
    sourceWrapper.className = SOURCE_CLASS;
    sourceWrapper.innerHTML = 'Loading...';
    candidate.append(sourceWrapper);
    sourceText.set(candidate, 'Loading...');
    const translation = doc.createElement('span');
    translation.className = TRANSLATION_CLASS;
    translation.textContent = '加载中…';
    candidate.append(translation);

    // Simulate hydration: source text changes
    sourceWrapper.innerHTML = 'Weekly update';

    const result = clearCandidate(candidate, sourceText);
    expect(result).toBe(true);
    expect(candidate.querySelector(`.${TRANSLATION_CLASS}`)).toBe(null);
    expect(sourceText.get(candidate)).toBe('Weekly update');
  });

  it('removes the translation on first clear, then no-ops for unchanged text', () => {
    const { root: candidate, document: doc } = makeFragment('<p id="c3">Hello world</p>');
    const sourceText = new WeakMap<HTMLElement, string>();
    const sourceWrapper = doc.createElement('span');
    sourceWrapper.className = SOURCE_CLASS;
    sourceWrapper.innerHTML = 'Hello world';
    candidate.append(sourceWrapper);
    const translation = doc.createElement('span');
    translation.className = TRANSLATION_CLASS;
    candidate.append(translation);

    const result = clearCandidate(candidate, sourceText);
    expect(result).toBe(true);
    expect(candidate.querySelector(`.${TRANSLATION_CLASS}`)).toBe(null);
    expect(sourceText.get(candidate)).toBe('Hello world');

    const result2 = clearCandidate(candidate, sourceText);
    expect(result2).toBe(false);
  });

  it('uses the range-replace marker as the canonical source snapshot during cleanup', () => {
    const { root: candidate } = makeFragment('<p id="range-cache">Hello</p>');
    const sourceText = new WeakMap<HTMLElement, string>();

    insertTranslation(candidate, '你好', 'zh-CN', 'range-replace');
    // Simulate a stale snapshot from a prior route so cleanup is required.
    sourceText.set(candidate, 'Previous route');

    expect(clearCandidate(candidate, sourceText)).toBe(true);
    expect(candidate.textContent).toBe('Hello');
    expect(sourceText.get(candidate)).toBe('Hello');

    // A second reconciliation must see the restored source as unchanged,
    // rather than treating the temporary model output as a new source.
    expect(clearCandidate(candidate, sourceText)).toBe(false);
    expect(sourceText.get(candidate)).toBe('Hello');
  });
});

describe('dynamic-content mutation boundaries', () => {
  type ObserverRecord = {
    type: MutationRecord['type'];
    target: Node;
    addedNodes?: Node[];
    removedNodes?: Node[];
  };
  class TestMutationObserver {
    static instances: TestMutationObserver[] = [];
    readonly callback: (records: MutationRecord[]) => void;
    observedTarget: Node | null = null;
    observedOptions: MutationObserverInit | null = null;
    disconnected = false;

    constructor(callback: (records: MutationRecord[]) => void) {
      this.callback = callback;
      TestMutationObserver.instances.push(this);
    }

    observe(target: Node, options: MutationObserverInit): void {
      this.observedTarget = target;
      this.observedOptions = options;
    }

    disconnect(): void {
      this.disconnected = true;
    }

    trigger(record: ObserverRecord): void {
      this.callback([{
        type: record.type,
        target: record.target,
        addedNodes: record.addedNodes || [],
        removedNodes: record.removedNodes || [],
      } as unknown as MutationRecord]);
    }
  }

  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    const previous = {
      document: globalThis.document,
      window: globalThis.window,
      MutationObserver: globalThis.MutationObserver,
      Element: globalThis.Element,
      HTMLElement: globalThis.HTMLElement,
      Node: globalThis.Node,
    };
    const env = parseHTML('<!doctype html><html><body></body></html>');
    vi.stubGlobal('document', env.document);
    vi.stubGlobal('window', env.window);
    TestMutationObserver.instances = [];
    vi.stubGlobal('MutationObserver', TestMutationObserver);
    vi.stubGlobal('Element', env.window.Element);
    vi.stubGlobal('HTMLElement', env.window.HTMLElement);
    vi.stubGlobal('Node', env.window.Node);
    restoreDom = () => {
      vi.stubGlobal('document', previous.document);
      vi.stubGlobal('window', previous.window);
      vi.stubGlobal('MutationObserver', previous.MutationObserver);
      vi.stubGlobal('Element', previous.Element);
      vi.stubGlobal('HTMLElement', previous.HTMLElement);
      vi.stubGlobal('Node', previous.Node);
    };
  });

  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
    vi.restoreAllMocks();
  });

  it('does not swallow real text edits made inside a rendered source wrapper', async () => {
    const candidate = document.createElement('p');
    candidate.setAttribute(SOURCE_BLOCK_ID_ATTRIBUTE, 'block-1');
    const source = document.createElement('span');
    source.className = SOURCE_CLASS;
    source.textContent = 'Before';
    const translation = document.createElement('span');
    translation.className = TRANSLATION_CLASS;
    translation.setAttribute('data-textduet-owner-id', 'block-1');
    translation.textContent = '之前';
    candidate.append(source, translation);
    document.body.append(candidate);

    const sourceText = new WeakMap<HTMLElement, string>();
    sourceText.set(candidate, 'Before');
    let scans = 0;
    let changedElements: readonly HTMLElement[] = [];
    const handle = observeDynamicContent(sourceText, (elements) => {
      scans += 1;
      changedElements = elements || [];
    });

    const oldText = source.firstChild as Node;
    source.textContent = 'After';
    const observer = TestMutationObserver.instances[0];
    observer?.trigger({
      type: 'childList',
      target: source,
      addedNodes: [source.firstChild as Node],
      removedNodes: [oldText],
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(scans).toBe(1);
    expect(changedElements).toContain(candidate);
    expect(candidate.querySelector(`.${TRANSLATION_CLASS}`)).toBeNull();
    expect(sourceText.get(candidate)).toBe('After');
    handle.disconnect();
  });

  it('schedules a scan for visibility-related attribute changes', async () => {
    const candidate = document.createElement('p');
    candidate.textContent = 'Visible later';
    candidate.hidden = true;
    document.body.append(candidate);

    const sourceText = new WeakMap<HTMLElement, string>();
    sourceText.set(candidate, 'Visible later');
    let scans = 0;
    const handle = observeDynamicContent(sourceText, () => { scans += 1; });

    candidate.hidden = false;
    const observer = TestMutationObserver.instances[0];
    observer?.trigger({ type: 'attributes', target: candidate });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(scans).toBe(1);
    handle.disconnect();
  });

  it('reads and clears an owned translation through an arbitrary page wrapper', () => {
    const { root: candidate, document: doc } = makeFragment('<p>Original</p>');
    candidate.setAttribute(SOURCE_BLOCK_ID_ATTRIBUTE, 'block-wrapper');
    const original = candidate.firstChild;
    const wrapper = doc.createElement('span');
    wrapper.className = 'spa-wrapper';
    const source = doc.createElement('span');
    source.className = SOURCE_CLASS;
    source.textContent = 'Original';
    const translation = doc.createElement('span');
    translation.className = TRANSLATION_CLASS;
    translation.setAttribute('data-textduet-owner-id', 'block-wrapper');
    translation.textContent = '原文';
    if (original) original.remove();
    wrapper.append(source, translation);
    candidate.append(wrapper);

    const sourceText = new WeakMap<HTMLElement, string>();
    sourceText.set(candidate, 'Original');
    expect(clearCandidate(candidate, sourceText)).toBe(false);
    expect(candidate.querySelector(`.${TRANSLATION_CLASS}`)).toBe(translation);

    source.textContent = 'Changed';
    expect(clearCandidate(candidate, sourceText)).toBe(true);
    expect(candidate.querySelector(`.${TRANSLATION_CLASS}`)).toBeNull();
    expect(sourceText.get(candidate)).toBe('Changed');
  });

  it('does not remove a separately owned nested translation when the parent changes', () => {
    const { root: parent, document: doc } = makeFragment('<div><p>Parent</p></div>');
    parent.setAttribute(SOURCE_BLOCK_ID_ATTRIBUTE, 'parent-block');
    const child = doc.createElement('p');
    child.setAttribute(SOURCE_BLOCK_ID_ATTRIBUTE, 'child-block');
    const childSource = doc.createElement('span');
    childSource.className = SOURCE_CLASS;
    childSource.textContent = 'Child';
    const childTranslation = doc.createElement('span');
    childTranslation.className = TRANSLATION_CLASS;
    childTranslation.setAttribute('data-textduet-owner-id', 'child-block');
    childTranslation.textContent = '子项';
    child.append(childSource, childTranslation);
    parent.append(child);

    const sourceText = new WeakMap<HTMLElement, string>();
    sourceText.set(parent, 'ParentChild');
    expect(clearCandidate(parent, sourceText)).toBe(true);
    expect(child.querySelector(`.${TRANSLATION_CLASS}`)).toBe(childTranslation);
  });

  it('removes a legacy ownerless translation moved under a generic wrapper when text changes', () => {
    const { root: candidate, document: doc } = makeFragment('<p>Before</p>');
    candidate.setAttribute(SOURCE_BLOCK_ID_ATTRIBUTE, 'legacy-parent');
    const source = doc.createElement('span');
    source.className = SOURCE_CLASS;
    source.textContent = 'Before';
    const wrapper = doc.createElement('span');
    wrapper.className = 'spa-wrapper';
    const legacyTranslation = doc.createElement('span');
    legacyTranslation.className = TRANSLATION_CLASS;
    legacyTranslation.textContent = '之前';
    wrapper.append(source, legacyTranslation);
    candidate.replaceChildren(wrapper);

    const sourceText = new WeakMap<HTMLElement, string>();
    sourceText.set(candidate, 'Before');
    source.textContent = 'After';

    expect(clearCandidate(candidate, sourceText)).toBe(true);
    expect(candidate.querySelector(`.${TRANSLATION_CLASS}`)).toBeNull();
    expect(sourceText.get(candidate)).toBe('After');
  });

  it('force-clears an owned translation when eligibility changes but text stays the same', () => {
    const { root: candidate, document: doc } = makeFragment('<p>Read this later</p>');
    candidate.setAttribute(SOURCE_BLOCK_ID_ATTRIBUTE, 'eligibility-block');
    const source = doc.createElement('span');
    source.className = SOURCE_CLASS;
    source.textContent = 'Read this later';
    const translation = doc.createElement('span');
    translation.className = TRANSLATION_CLASS;
    translation.setAttribute('data-textduet-owner-id', 'eligibility-block');
    translation.textContent = '稍后阅读';
    candidate.replaceChildren(source, translation);

    const sourceText = new WeakMap<HTMLElement, string>();
    sourceText.set(candidate, 'Read this later');
    expect(clearCandidate(candidate, sourceText)).toBe(false);
    expect(candidate.querySelector(`.${TRANSLATION_CLASS}`)).toBe(translation);

    expect(clearCandidate(candidate, sourceText, { force: true })).toBe(true);
    expect(candidate.querySelector(`.${TRANSLATION_CLASS}`)).toBeNull();
  });

  it('clears only ineligible managed owners while preserving eligible and nested owners', () => {
    const { root, document: doc } = makeFragment(
      '<div id="parent"><p id="child">Child copy</p><p id="stale">Action copy</p></div>',
    );
    const parent = root.querySelector('#parent') as HTMLElement;
    const child = root.querySelector('#child') as HTMLElement;
    const stale = root.querySelector('#stale') as HTMLElement;
    parent.setAttribute(SOURCE_BLOCK_ID_ATTRIBUTE, 'parent-owner');
    child.setAttribute(SOURCE_BLOCK_ID_ATTRIBUTE, 'child-owner');
    stale.setAttribute(SOURCE_BLOCK_ID_ATTRIBUTE, 'stale-owner');

    const addTranslation = (element: HTMLElement, owner: string, text: string) => {
      const span = doc.createElement('span');
      span.className = TRANSLATION_CLASS;
      span.setAttribute('data-textduet-owner-id', owner);
      span.textContent = text;
      element.append(span);
      return span;
    };
    const parentTranslation = addTranslation(parent, 'parent-owner', '父级');
    const childTranslation = addTranslation(child, 'child-owner', '子项');
    const staleTranslation = addTranslation(stale, 'stale-owner', '操作');
    const sourceText = new WeakMap<HTMLElement, string>();
    sourceText.set(parent, 'Child copyAction copy');
    sourceText.set(child, 'Child copy');
    sourceText.set(stale, 'Action copy');

    const cleared = clearIneligibleManagedSources(
      root,
      new Set<HTMLElement>([child]),
      sourceText,
    );
    expect(cleared).toEqual(expect.arrayContaining([parent, stale]));
    expect(child.querySelector(`.${TRANSLATION_CLASS}`)).toBe(childTranslation);
    expect(stale.querySelector(`.${TRANSLATION_CLASS}`)).toBeNull();
    expect(parentTranslation.isConnected).toBe(false);
    expect(parent.querySelector(`.${TRANSLATION_CLASS}[data-textduet-owner-id="parent-owner"]`)).toBeNull();
    expect(cleared).toHaveLength(2);
  });

  it('clears a translated node when the real extractor excludes a newly interactive role', () => {
    const { root, document: doc } = makeFragment('<p id="nav-copy">Open documentation</p>');
    const candidate = root.querySelector('#nav-copy') as HTMLElement;
    candidate.setAttribute(SOURCE_BLOCK_ID_ATTRIBUTE, 'role-owner');
    const source = doc.createElement('span');
    source.className = SOURCE_CLASS;
    source.textContent = 'Open documentation';
    const translation = doc.createElement('span');
    translation.className = TRANSLATION_CLASS;
    translation.setAttribute('data-textduet-owner-id', 'role-owner');
    translation.textContent = '打开文档';
    candidate.replaceChildren(source, translation);

    const sourceText = new WeakMap<HTMLElement, string>();
    sourceText.set(candidate, 'Open documentation');
    const getId = (element: HTMLElement): string =>
      element === candidate ? 'role-owner' : 'unexpected';
    const getText = (element: HTMLElement): string => readTextWithoutTranslations(element);

    candidate.setAttribute('role', 'button');
    const excluded = collectTranslationCandidates(doc, {
      getId,
      getText,
      isVisible: () => true,
    });
    expect(excluded.some(({ element }) => element === candidate)).toBe(false);
    clearIneligibleManagedSources(doc, new Set(excluded.map(({ element }) => element)), sourceText);
    expect(candidate.querySelector(`.${TRANSLATION_CLASS}`)).toBeNull();

    candidate.removeAttribute('role');
    const restored = collectTranslationCandidates(doc, {
      getId,
      getText,
      isVisible: () => true,
    });
    expect(restored.some(({ element }) => element === candidate)).toBe(true);
  });
});

import {
  scheduleBackgroundTask,
  yieldToMain,
  isBackgroundTaskSchedulerAvailable,
} from '@/src/translator/scheduler-helper';

describe('scheduler-helper (Layer 4)', () => {
  it('runs the callback when no signal is provided', async () => {
    let called = false;
    await scheduleBackgroundTask(() => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('skips execution when the signal is already aborted', async () => {
    let called = false;
    const ac = new AbortController();
    ac.abort();
    await scheduleBackgroundTask(
      () => {
        called = true;
      },
      { signal: ac.signal },
    );
    expect(called).toBe(false);
  });

  it('awaits an async callback before resolving', async () => {
    const events: string[] = [];
    await scheduleBackgroundTask(async () => {
      events.push('start');
      await Promise.resolve();
      events.push('end');
    });
    expect(events).toEqual(['start', 'end']);
  });

  it('yieldToMain resolves without throwing in node', async () => {
    await expect(yieldToMain()).resolves.toBeUndefined();
  });

  it('isBackgroundTaskSchedulerAvailable returns a boolean (no throw in node env)', () => {
    expect(typeof isBackgroundTaskSchedulerAvailable()).toBe('boolean');
  });
});
