import type { TranslatedBlock, TranslationBlock } from '@/src/core/contracts';
import { resolveReadableTranslationColor } from '@/src/core/translation-colors';
import {
  SOURCE_CLASS,
  SOURCE_BLOCK_ID_ATTRIBUTE,
  TRANSLATION_CLASS,
} from './page-status';
import {
  insertTranslation,
  removeInsertedTranslation,
  isHighlightApiAvailable,
} from './insert-strategies';

/**
 * Element-level translation registry. Maps each source element to its
 * currently-attached translation span so we always have a single source
 * of truth — re-renders after SPA navigation can rely on it instead of
 * trying to recover the previous span from a possibly-restructured DOM
 * (the old `:scope > .td-translation` selector failed when React
 * re-wrapped the children, leading to stacked duplicates).
 */
const translationByElement = new WeakMap<HTMLElement, HTMLElement>();

/**
 * Binds an inserted translation to the exact source block that owns it.
 * DOM structure alone is not a safe ownership signal: a SPA can move a
 * translation under an arbitrary wrapper, and a parent candidate can have
 * independently translated child candidates. Keeping the owner on the span
 * lets reconciliation recover the right translation without suppressing or
 * deleting a real child translation.
 */
export const TRANSLATION_OWNER_ATTRIBUTE = 'data-textduet-owner-id';

/**
 * Dedup helper. Returns the existing translation span for the source
 * element if one is already attached. It removes only duplicate spans
 * owned by the same source block; translations owned by real nested
 * blocks remain untouched.
 *
 * Explicit owner markers support any wrapper depth after a SPA
 * reconciliation. The legacy fallback is intentionally narrow so an
 * unrelated nested child translation is never taken over by its parent.
 */
function dedupSourceTranslations(
  sourceElement: HTMLElement,
  ownerId: string,
): HTMLElement | null {
  const all = Array.from(sourceElement.querySelectorAll<HTMLElement>(`.${TRANSLATION_CLASS}`));
  const matching = all.filter((candidate) => isTranslationOwnedBySource(
    sourceElement,
    candidate,
    ownerId,
  ));
  const registered = translationByElement.get(sourceElement);
  const primary = registered && matching.includes(registered)
    ? registered
    : matching[0] ?? null;

  for (const candidate of matching) {
    if (candidate !== primary) candidate.remove();
  }

  return primary;
}

/**
 * Determines whether a rendered span belongs to this exact source element.
 * Modern TextDuet spans carry an explicit owner marker and may therefore be
 * recovered through any number of framework wrappers. The narrow structural
 * fallback only supports legacy, unmarked spans at the two placements written
 * by older releases; it deliberately never claims a nested child block's
 * translation as the parent block's own translation.
 */
function isTranslationOwnedBySource(
  sourceElement: HTMLElement,
  translation: HTMLElement,
  ownerId: string,
): boolean {
  if (!sourceElement.contains(translation)) return false;
  const markedOwner = translation.getAttribute(TRANSLATION_OWNER_ATTRIBUTE);
  if (markedOwner !== null) return markedOwner === ownerId;

  // Upgrade path for translations rendered before owner markers existed:
  // recover an unmarked span through the nearest marked source element, not
  // through arbitrary descendant position. This safely supports framework
  // wrappers at any depth while preserving a separately translated child.
  const legacySource = findNearestMarkedSource(translation);
  if (legacySource) return legacySource === sourceElement;

  if (translation.parentElement === sourceElement) return true;
  const sourceWrapper = sourceElement.querySelector<HTMLElement>(`:scope > .${SOURCE_CLASS}`);
  return sourceWrapper !== null && translation.parentElement === sourceWrapper;
}

/**
 * Finds the source wrapper owned by this exact managed element. Frameworks can
 * insert arbitrary ordinary wrappers around TextDuet's source span, so a
 * direct-child selector is insufficient and would create nested source
 * wrappers on every reconciliation pass.
 */
function findOwnedSourceWrapper(sourceElement: HTMLElement): HTMLElement | null {
  const wrappers = Array.from(
    sourceElement.querySelectorAll<HTMLElement>(`.${SOURCE_CLASS}`),
  );
  for (const wrapper of wrappers) {
    let owner: HTMLElement | null = wrapper.parentElement;
    while (owner && !owner.hasAttribute(SOURCE_BLOCK_ID_ATTRIBUTE)) {
      owner = owner.parentElement;
    }
    if (owner === sourceElement) return wrapper;
  }
  // Legacy output may not have a managed source marker yet. It is safe to
  // reuse the only wrapper when no owner can be established; nested managed
  // blocks are handled by the owner-aware branch above.
  return wrappers.length === 1 ? wrappers[0] ?? null : null;
}

function findNearestMarkedSource(translation: HTMLElement): HTMLElement | null {
  let ancestor = translation.parentElement;
  while (ancestor) {
    if (ancestor.hasAttribute(SOURCE_BLOCK_ID_ATTRIBUTE)) return ancestor;
    ancestor = ancestor.parentElement;
  }
  return null;
}

/**
 * Reconcile the one translation owned by a source block. This is used by both
 * the scan filter and the renderer so they cannot disagree about whether a
 * block is already translated. If a SPA moved an owned span into a source
 * wrapper, move it back to a direct child: otherwise `translated-only` mode
 * would hide the translation together with the source wrapper.
 */
export function reconcileRenderedTranslation(
  sourceElement: HTMLElement,
  ownerId: string,
): HTMLElement | null {
  const existing = dedupSourceTranslations(sourceElement, ownerId);
  if (!existing) return null;

  existing.setAttribute(TRANSLATION_OWNER_ATTRIBUTE, ownerId);
  if (existing.parentElement !== sourceElement) {
    sourceElement.append(existing);
  }
  translationByElement.set(sourceElement, existing);
  return existing;
}

/** Inserts validated model output as text while preserving the source element. */
export interface RenderOptions {
  /**
   * L6: when true, register the source range with the `CSS.highlights` API
   * as an optional visual adornment. Custom Highlights cannot render
   * replacement text, so the adjacent plain-text translation remains the
   * source of visible output. The option falls back to the normal adjacent
   * path when the browser does not expose the API.
   */
  useHighlight?: boolean;
}

export function renderTranslations(
  candidates: Array<TranslationBlock & { element: HTMLElement }>,
  translations: TranslatedBlock[],
  targetLanguage: string,
  options: RenderOptions = {},
): void {
  const useHighlight = options.useHighlight === true && isHighlightApiAvailable();
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));

  for (const translation of translations) {
    const sourceBlock = candidatesById.get(translation.id);
    if (!sourceBlock) continue;
    const sourceElement = sourceBlock.element;

    // The owner marker is based on the element-level id, never text content:
    // two real navigation items with the same label must remain independent.
    sourceElement.setAttribute(SOURCE_BLOCK_ID_ATTRIBUTE, sourceBlock.id);

    // Per-element dedup: SPA frameworks (Next.js App Router, React 18
    // hydration) may re-wrap the same logical block between renders.
    // Reconcile by explicit owner rather than by arbitrary descendant so
    // translations from real nested blocks are never deleted or reused.
    const existing = reconcileRenderedTranslation(sourceElement, sourceBlock.id);

    if (useHighlight) {
      // CSS Custom Highlights paint an existing range; they cannot display
      // replacement text. Keep the adjacent span as the authoritative,
      // visible translation and use the Highlight only as an optional
      // source-range adornment. Ensure the source wrapper exists first so a
      // legacy adjacent span can never become part of the range.
      ensureSourceWrapper(sourceElement);
      insertTranslation(sourceElement, translation.translatedText, targetLanguage, 'highlight');
    } else {
      // A run can switch strategies after a settings change or a SPA
      // remount. Remove any old range before rendering adjacent output so it
      // cannot paint stale source text or retain registry state.
      removeInsertedTranslation(sourceElement, 'highlight');
      // `range-replace` is opt-in and can be left behind by a previous
      // renderer invocation. Restore its source before wrapping it for the
      // adjacent strategy so the original text, rather than the old
      // translation, is preserved in the source wrapper.
      removeInsertedTranslation(sourceElement, 'range-replace');
    }

    ensureSourceWrapper(sourceElement);
    const ownerDocument = sourceElement.ownerDocument ?? globalThis.document;
    if (!ownerDocument) continue;
    const translatedElement = existing || ownerDocument.createElement('span');
    translatedElement.className = TRANSLATION_CLASS;
    translatedElement.setAttribute(TRANSLATION_OWNER_ATTRIBUTE, sourceBlock.id);
    translatedElement.lang = targetLanguage;
    translatedElement.textContent = translation.translatedText;
    if (sourceBlock.styleContext) {
      translatedElement.style.setProperty(
        'color',
        // A model response must never make adjacent translations use
        // different configured colors. The deterministic guard only
        // falls back when the user-selected color is genuinely
        // unreadable on this block.
        resolveReadableTranslationColor(sourceBlock.styleContext, 'preferred'),
        'important',
      );
    } else {
      translatedElement.style.removeProperty('color');
    }
    if (!existing) sourceElement.append(translatedElement);
    translationByElement.set(sourceElement, translatedElement);
  }
}

export function removeRenderedTranslations(root: ParentNode = document): void {
  // Avoid a realm-specific `instanceof HTMLElement`: the Translator can run
  // against an embedded document (and tests use linkedom) where that global
  // constructor is not installed.
  const rootElement = root.nodeType === 1 ? root as HTMLElement : null;
  const translations = [
    ...(rootElement?.matches(`.${TRANSLATION_CLASS}`) ? [rootElement] : []),
    ...root.querySelectorAll<HTMLElement>(`.${TRANSLATION_CLASS}`),
  ];
  translations.forEach((element) => element.remove());

  const wrappers = [
    ...(rootElement?.matches(`.${SOURCE_CLASS}`) ? [rootElement] : []),
    ...root.querySelectorAll<HTMLElement>(`.${SOURCE_CLASS}`),
  ];
  wrappers.forEach((wrapper) => {
    const parent = wrapper.parentNode;
    if (!parent) return;
    while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
    wrapper.remove();
  });
  // L6: any element that opted into the highlight strategy carries a
  // `data-td-highlight-text` attribute; ask the strategy helper to
  // drop the corresponding Highlight from `CSS.highlights` and strip
  // the data attribute so the next scan starts from a clean slate.
  const highlighted = [
    ...(rootElement?.hasAttribute('data-td-highlight-text') ? [rootElement] : []),
    ...root.querySelectorAll<HTMLElement>('[data-td-highlight-text]'),
  ];
  highlighted.forEach((element) => {
    removeInsertedTranslation(element, 'highlight');
  });
  // Range replacement has no marker class of its own. Include the root and
  // descendants explicitly so stopping a run or switching strategies always
  // restores the page-owned source text.
  const rangeReplaced = [
    ...(rootElement?.hasAttribute('data-td-original-text') ? [rootElement] : []),
    ...root.querySelectorAll<HTMLElement>('[data-td-original-text]'),
  ];
  rangeReplaced.forEach((element) => {
    removeInsertedTranslation(element, 'range-replace');
  });
  // The element-level registry is a WeakMap keyed by detached elements;
  // when the source elements are GC'd, their registry entries drop
  // automatically. We do not need to clear the map explicitly here.
}

function ensureSourceWrapper(sourceElement: HTMLElement): void {
  if (findOwnedSourceWrapper(sourceElement)) return;
  // Use the source element's own document so this works under any DOM
  // implementation (browser, linkedom, jsdom). The previous version
  // grabbed the global `document` directly, which is undefined in
  // non-browser test environments.
  const ownerDocument = sourceElement.ownerDocument ?? globalThis.document;
  if (!ownerDocument) return;
  const sourceWrapper = ownerDocument.createElement('span');
  sourceWrapper.className = SOURCE_CLASS;
  // Duck-type HTMLElement check so this works in node + linkedom
  // (where the `HTMLElement` global is not bound). The test for
  // `classList` is what actually matters; if the node is an Element
  // and has the translation class, it is a stale translation span.
  const isTranslationSpan = (node: Node): boolean =>
    Boolean((node as Element).classList?.contains?.(TRANSLATION_CLASS));
  const originalNodes = [...sourceElement.childNodes].filter(
    (node) => !isTranslationSpan(node),
  );
  originalNodes.forEach((node) => sourceWrapper.append(node));
  sourceElement.insertBefore(sourceWrapper, sourceElement.firstChild);
}
