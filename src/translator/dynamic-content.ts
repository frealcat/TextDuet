import { TRANSLATION_BLOCK_SELECTOR } from './dom-extraction';
import { SOURCE_CLASS, TRANSLATION_CLASS } from './page-status';
import { scheduleBackgroundTask } from './scheduler-helper';

export const DYNAMIC_CONTENT_SCAN_DELAY_MS = 250;

/**
 * Augmented handle returned by `observeDynamicContent`. Adds an
 * `abort` method to the underlying `MutationObserver` so callers
 * (Layer 7 SPA reset, `stopActiveRun`) can cancel in-flight
 * `scheduler.postTask` callbacks without having to know about the
 * `AbortController` plumbing.
 */
export interface DynamicContentHandle {
  disconnect(): void;
  /** Cancel any in-flight `onContentChanged` callback. Idempotent. */
  abort(): void;
}

/** Observes only the active page session and suppresses mutations created by TextDuet itself. */
export function observeDynamicContent(
  sourceTextByElement: WeakMap<HTMLElement, string>,
  onContentChanged: () => void,
): DynamicContentHandle {
  const ac = new AbortController();
  const observer = new MutationObserver((records) => {
    if (ac.signal.aborted) return;
    const relevantRecords = records.filter((record) => !isTextDuetMutation(record));
    if (relevantRecords.length === 0) return;
    let anyTextChanged = false;
    for (const record of relevantRecords) {
      const changed = invalidateChangedCandidate(record, sourceTextByElement);
      if (changed) anyTextChanged = true;
    }
    if (!anyTextChanged) return;
    // Layer 4: schedule the heavy work at background priority. If the
    // SPA navigates away (Layer 7) or the run stops, the AbortSignal
    // is triggered and the callback is dropped before it ever runs.
    void scheduleBackgroundTask(() => onContentChanged(), {
      priority: 'background',
      signal: ac.signal,
    });
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['aria-hidden', 'class', 'hidden', 'style'],
    childList: true,
    characterData: true,
    subtree: true,
  });
  return {
    disconnect: () => observer.disconnect(),
    abort: () => ac.abort(),
  };
}

function isTextDuetMutation(record: MutationRecord): boolean {
  const target = record.target instanceof Element ? record.target : record.target.parentElement;
  if (target?.closest(`.${TRANSLATION_CLASS}, .${SOURCE_CLASS}, #textduet-styles`)) return true;
  if (record.type !== 'childList') return false;
  return record.addedNodes.length > 0
    && [...record.addedNodes].every(isTextDuetNode);
}

function isTextDuetNode(node: Node): boolean {
  if (!(node instanceof Element)) return false;
  return node.matches(`.${TRANSLATION_CLASS}, .${SOURCE_CLASS}, #textduet-styles`)
    || Boolean(node.closest(`.${TRANSLATION_CLASS}, .${SOURCE_CLASS}, #textduet-styles`));
}

function invalidateChangedCandidate(
  record: MutationRecord,
  sourceTextByElement: WeakMap<HTMLElement, string>,
): boolean {
  let changed = false;
  if (record.type === 'attributes') return false;
  const target = record.target instanceof HTMLElement
    ? record.target
    : record.target.parentElement;
  const candidate = target?.closest<HTMLElement>(TRANSLATION_BLOCK_SELECTOR);
  if (candidate && clearCandidate(candidate, sourceTextByElement)) changed = true;

  if (record.type !== 'childList') return changed;
  for (const addedNode of record.addedNodes) {
    if (!(addedNode instanceof HTMLElement)) continue;
    if (addedNode.matches(TRANSLATION_BLOCK_SELECTOR)) {
      if (clearCandidate(addedNode, sourceTextByElement)) changed = true;
    }
    for (const addedCandidate of addedNode.querySelectorAll<HTMLElement>(
      TRANSLATION_BLOCK_SELECTOR,
    )) {
      if (clearCandidate(addedCandidate, sourceTextByElement)) changed = true;
    }
  }
  return changed;
}

export function clearCandidate(
  candidate: HTMLElement,
  sourceTextByElement: WeakMap<HTMLElement, string>,
): boolean {
  // BREAK TRANSLATION LOOP: only remove the existing translation if the
  // candidate's text actually changed. Otherwise the MutationObserver
  // fires on every React re-render / SPA hydration tick, removes the
  // translation, and the next scan re-translates the same text — yielding
  // 30+ identical translation spans accumulating in the DOM.
  //
  // SPA frameworks (Next.js 14, Vue 3, React 18) often mutate ancestor
  // attributes or character data without changing the user-visible text.
  // Skipping the cleanup in that case keeps the existing translation and
  // lets `getSourceText` reuse the cached value, so no API call happens.
  // Read the source text from the `<span class="td-source">` wrapper when
  // present. `candidate.innerText` would include both the original text
  // and the appended translation span, so it always differs from the
  // cached original even when the source has not changed. The wrapper
  // isolates just the original text we want to compare against.
  const sourceWrapper = candidate.querySelector<HTMLElement>(`:scope > .${SOURCE_CLASS}`);
  const currentText = sourceWrapper ? sourceWrapper.innerText : candidate.innerText;
  const cachedText = sourceTextByElement.get(candidate);
  if (cachedText !== undefined && cachedText === currentText) {
    return false;
  }
  candidate.querySelector<HTMLElement>(`:scope > .${TRANSLATION_CLASS}`)?.remove();
  // Update cache to the current (possibly new) text so the next clear
  // call can correctly compare against it.
  sourceTextByElement.set(candidate, currentText);
  return true;
}
