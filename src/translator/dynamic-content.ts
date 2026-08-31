import {
  extractReadableText,
  TRANSLATION_BLOCK_SELECTOR,
} from './dom-extraction';
import { normalizeTranslationText } from '@/src/core/translation-planning';
import {
  SOURCE_BLOCK_ID_ATTRIBUTE,
  SOURCE_CLASS,
  SELECTION_ERROR_CLASS,
  SELECTION_QUICK_ACTION_CLASS,
  SELECTION_TRANSLATION_CLASS,
  TRANSLATION_CLASS,
} from './page-status';
import { removeInsertedTranslation } from './insert-strategies';
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

export type DynamicContentChangedCallback = (
  changedElements?: readonly HTMLElement[],
) => void;

export interface ClearCandidateOptions {
  /**
   * Remove the owned output even when the source text is unchanged. This is
   * needed when a candidate becomes ineligible (for example, a page adds
   * `hidden` or `role="button"`) while its old translation is still present.
   */
  force?: boolean;
}

/**
 * Removes output owned by managed source blocks that no longer qualify for
 * the current candidate set. Eligibility can change without a text mutation
 * (for example `role="button"`, `hidden`, or an ancestor exclusion class),
 * so the normal text-equality guard in `clearCandidate` is insufficient.
 *
 * The returned elements are the managed blocks that were processed. Callers
 * use them to drop any per-view success/failure bookkeeping keyed by their
 * stable element id. Nested managed blocks are intentionally processed
 * independently; `removeOwnedTranslations` preserves each distinct owner.
 */
export function clearIneligibleManagedSources(
  root: ParentNode,
  eligibleElements: ReadonlySet<HTMLElement>,
  sourceTextByElement: WeakMap<HTMLElement, string>,
): HTMLElement[] {
  const managed = new Set<HTMLElement>();
  const rootElement = asElement(root as unknown as Node);
  if (rootElement?.hasAttribute(SOURCE_BLOCK_ID_ATTRIBUTE)) {
    managed.add(rootElement);
  }
  root.querySelectorAll<HTMLElement>(`[${SOURCE_BLOCK_ID_ATTRIBUTE}]`).forEach((element) => {
    managed.add(element);
  });

  const ineligible: HTMLElement[] = [];
  for (const element of managed) {
    if (eligibleElements.has(element)) continue;
    clearCandidate(element, sourceTextByElement, { force: true });
    ineligible.push(element);
  }
  return ineligible;
}

/** Observes only the active page session and suppresses mutations created by TextDuet itself. */
export function observeDynamicContent(
  sourceTextByElement: WeakMap<HTMLElement, string>,
  onContentChanged: DynamicContentChangedCallback,
): DynamicContentHandle {
  const ac = new AbortController();
  const observer = new MutationObserver((records) => {
    if (ac.signal.aborted) return;
    const relevantRecords = records.filter((record) => !isTextDuetMutation(record));
    if (relevantRecords.length === 0) return;
    // A relevant mutation may only change visibility or wrapper structure,
    // so it still needs a reconciliation scan even when the source text
    // snapshot remains equal. `clearCandidate` remains responsible for
    // avoiding unnecessary translation removal/API work.
    const changedCandidates = new Set<HTMLElement>();
    for (const record of relevantRecords) {
      invalidateChangedCandidate(record, sourceTextByElement)
        .forEach((candidate) => changedCandidates.add(candidate));
    }
    // Layer 4: schedule the heavy work at background priority. If the
    // SPA navigates away (Layer 7) or the run stops, the AbortSignal
    // is triggered and the callback is dropped before it ever runs.
    void scheduleBackgroundTask(() => onContentChanged([...changedCandidates]), {
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
  const target = mutationTargetElement(record);
  // Mutations to rendered output or the injected stylesheet are always ours.
  // A source wrapper is deliberately absent here: it contains page-owned
  // text, and an ancestor-class check would swallow real edits made by the
  // page/framework inside that wrapper.
  if (target?.closest(
    `.${TRANSLATION_CLASS}, .${SELECTION_TRANSLATION_CLASS}, .${SELECTION_ERROR_CLASS}, `
      + `.${SELECTION_QUICK_ACTION_CLASS}, #textduet-styles`,
  )) return true;
  if (record.type !== 'childList') return false;

  // A child-list record is plugin-owned only when every affected node is a
  // TextDuet node. Generic page wrappers around our nodes remain relevant so
  // the next scan can reconcile them, and mixed page/plugin mutations are
  // never hidden.
  const affectedNodes = [...record.addedNodes, ...record.removedNodes];
  return affectedNodes.length > 0 && affectedNodes.every(isTextDuetNode);
}

function isTextDuetNode(node: Node): boolean {
  const element = asElement(node);
  if (!element) return false;
  return element.matches(
    `.${TRANSLATION_CLASS}, .${SOURCE_CLASS}, .${SELECTION_TRANSLATION_CLASS}, `
      + `.${SELECTION_ERROR_CLASS}, .${SELECTION_QUICK_ACTION_CLASS}, #textduet-styles`,
  );
}

function asElement(node: Node | null | undefined): HTMLElement | null {
  if (!node || node.nodeType !== 1) return null;
  return node as unknown as HTMLElement;
}

function mutationTargetElement(record: MutationRecord): HTMLElement | null {
  const direct = asElement(record.target);
  if (direct) return direct;
  return asElement(record.target.parentElement);
}

function invalidateChangedCandidate(
  record: MutationRecord,
  sourceTextByElement: WeakMap<HTMLElement, string>,
): Set<HTMLElement> {
  const changedCandidates = new Set<HTMLElement>();
  const mutationTargets = new Set<HTMLElement>();
  const target = mutationTargetElement(record);
  if (target) mutationTargets.add(target);
  // Some lightweight DOM implementations report text replacement with the
  // document root as `record.target`. The affected node's current parent is
  // still an authoritative path to the managed source block, and this also
  // handles browser records where a framework replaces a text node.
  for (const node of [...record.addedNodes, ...record.removedNodes]) {
    const parent = asElement(node.parentElement);
    if (parent) mutationTargets.add(parent);
  }
  for (const mutationTarget of mutationTargets) {
    const candidate = findMutationCandidate(mutationTarget);
    if (candidate && clearCandidate(candidate, sourceTextByElement)) {
      changedCandidates.add(candidate);
    }
  }

  if (record.type !== 'childList') return changedCandidates;
  for (const addedNode of record.addedNodes) {
    const addedElement = asElement(addedNode);
    if (!addedElement || isTextDuetOwnedElement(addedElement)) continue;
    if (addedElement.matches(TRANSLATION_BLOCK_SELECTOR)) {
      if (clearCandidate(addedElement, sourceTextByElement)) {
        changedCandidates.add(addedElement);
      }
    }
    for (const addedCandidate of addedElement.querySelectorAll<HTMLElement>(
      TRANSLATION_BLOCK_SELECTOR,
    )) {
      if (isTextDuetOwnedElement(addedCandidate)) continue;
      if (clearCandidate(addedCandidate, sourceTextByElement)) {
        changedCandidates.add(addedCandidate);
      }
    }
  }
  return changedCandidates;
}

/** Resolves a mutation to the logical source block, including arbitrary SPA wrappers. */
function findMutationCandidate(target: HTMLElement): HTMLElement | null {
  const managed = target.closest<HTMLElement>(`[${SOURCE_BLOCK_ID_ATTRIBUTE}]`);
  if (managed) return managed;
  return target.closest<HTMLElement>(TRANSLATION_BLOCK_SELECTOR);
}

export function clearCandidate(
  candidate: HTMLElement,
  sourceTextByElement: WeakMap<HTMLElement, string>,
  options: ClearCandidateOptions = {},
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
  const sourceWrapper = findSourceWrapper(candidate);
  // `range-replace` temporarily swaps the candidate's complete child list
  // for the model output. In that state there is no source wrapper to read,
  // and `candidate.textContent` is deliberately the translated text. The
  // marker is captured before the swap and is therefore the canonical source
  // snapshot until the strategy restores the original nodes below.
  const rangeReplaceOriginal = candidate.getAttribute('data-td-original-text');
  const currentText = rangeReplaceOriginal !== null
    ? rangeReplaceOriginal
    : sourceWrapper
      ? readTextWithoutTranslations(sourceWrapper)
      : readTextWithoutTranslations(candidate);
  const cachedText = sourceTextByElement.get(candidate);
  if (!options.force && cachedText !== undefined && cachedText === currentText) {
    return false;
  }
  removeOwnedTranslations(candidate);
  // A future run may use the CSS Highlight insertion strategy. Its output is
  // not represented by a `.textduet-translation` node, so the normal DOM
  // cleanup above would leave a stale range and data attributes behind.
  // `removeInsertedTranslation` is a no-op when no highlight is registered.
  removeInsertedTranslation(candidate, 'highlight');
  // Range replacement has no translation class, so restore it explicitly when
  // a candidate changes or becomes ineligible. This keeps later extraction
  // anchored to the page's original text and avoids translating the old
  // model output again.
  removeInsertedTranslation(candidate, 'range-replace');
  // Update cache to the current (possibly new) text so the next clear
  // call can correctly compare against it.
  sourceTextByElement.set(candidate, currentText);
  return true;
}

/**
 * Finds the source wrapper belonging to `candidate`, regardless of ordinary
 * framework wrappers inserted between the candidate and TextDuet's marker.
 * A nested marked source block is skipped so a parent never reads a child's
 * wrapper as its own source.
 */
function findSourceWrapper(candidate: HTMLElement): HTMLElement | null {
  const wrappers = candidate.querySelectorAll<HTMLElement>(`.${SOURCE_CLASS}`);
  for (const wrapper of wrappers) {
    let ancestor = wrapper.parentElement;
    let belongsToCandidate = true;
    while (ancestor && ancestor !== candidate) {
      if (ancestor.hasAttribute(SOURCE_BLOCK_ID_ATTRIBUTE)) {
        belongsToCandidate = false;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    if (belongsToCandidate && ancestor === candidate) return wrapper;
  }
  return null;
}

/** Returns visible/source text while excluding all rendered translations. */
/**
 * Reads the current page-owned text for a candidate while excluding every
 * TextDuet translation node. Exported for the Translator scan as well: a SPA
 * can reuse one HTMLElement for a different route without emitting a useful
 * mutation record before the next visibility/page-lifecycle scan.
 */
export function readTextWithoutTranslations(element: HTMLElement): string {
  // Keep this public wrapper for existing callers; the shared extractor also
  // removes interactive/hidden/inert descendants so dynamic snapshots obey
  // the same Provider boundary as initial candidate collection.
  return extractReadableText(element);
}

/**
 * Checks whether a request snapshot still describes the page-owned text.
 * Dynamic pages can mutate a reused element while a Provider request is in
 * flight; comparing the normalized, translation-free text prevents that old
 * response from being committed to the new view.
 */
export function isCurrentSourceText(element: HTMLElement, expectedText: string): boolean {
  return normalizeTranslationText(readTextWithoutTranslations(element))
    === normalizeTranslationText(expectedText);
}

/** Removes only translations owned by this source block. */
function removeOwnedTranslations(candidate: HTMLElement): void {
  const ownerId = candidate.getAttribute(SOURCE_BLOCK_ID_ATTRIBUTE);
  const translations = candidate.querySelectorAll<HTMLElement>(`.${TRANSLATION_CLASS}`);
  translations.forEach((translation) => {
    const markedOwner = translation.getAttribute('data-textduet-owner-id');
    if (ownerId !== null && markedOwner !== null) {
      if (markedOwner === ownerId) translation.remove();
      return;
    }

    // A nested source block is an independent candidate. Never remove its
    // translation while clearing the parent, even for legacy ownerless spans.
    let nearestManagedSource: HTMLElement | null = null;
    let ancestor = translation.parentElement;
    while (ancestor) {
      if (ancestor.hasAttribute(SOURCE_BLOCK_ID_ATTRIBUTE)) {
        nearestManagedSource = ancestor;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    if (nearestManagedSource && nearestManagedSource !== candidate) return;

    // Legacy releases placed an ownerless span directly under the candidate,
    // its source wrapper, or a framework wrapper around either. Once the
    // nearest managed source is this candidate, the span is ours; a nested
    // managed source was handled by the guard above and remains untouched.
    if (nearestManagedSource === candidate || translation.parentElement === candidate) {
      translation.remove();
      return;
    }
    const sourceWrapper = findSourceWrapper(candidate);
    if (sourceWrapper && sourceWrapper.contains(translation)) {
      translation.remove();
    }
  });
}

function isTextDuetOwnedElement(element: HTMLElement): boolean {
  return element.matches(
    `.${TRANSLATION_CLASS}, .${SOURCE_CLASS}, .${SELECTION_TRANSLATION_CLASS}, `
      + `.${SELECTION_ERROR_CLASS}, .${SELECTION_QUICK_ACTION_CLASS}, #textduet-styles`,
  );
}
