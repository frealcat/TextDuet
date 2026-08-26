import type { TranslatedBlock, TranslationBlock } from '@/src/core/contracts';
import { resolveReadableTranslationColor } from '@/src/core/translation-colors';
import {
  SOURCE_CLASS,
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
 * Dedup helper. Returns the existing translation span for the source
 * element if one is already attached, regardless of where in the
 * descendant tree the SPA framework put it. Removes any other
 * `.td-translation` descendants so the rendered result is always
 * single-translation (the runtime contract says we must not insert
 * duplicates).
 */
function dedupSourceTranslations(sourceElement: HTMLElement): HTMLElement | null {
  const registered = translationByElement.get(sourceElement);
  const registeredInDom = registered && registered.isConnected && registered.parentNode === sourceElement
    ? registered
    : null;
  const all = sourceElement.querySelectorAll<HTMLElement>(`.${TRANSLATION_CLASS}`);
  let primary: HTMLElement | null = registeredInDom;
  for (const candidate of all) {
    if (primary && candidate === primary) continue;
    candidate.remove();
  }
  return primary;
}

/** Inserts validated model output as text while preserving the source element. */
export interface RenderOptions {
  /**
   * L6: when true, use the `CSS.highlights` API instead of the
   * default `adjacent` DOM-wrapper strategy. The strategy is a
   * no-op for the renderer in terms of translated text — the
   * translated element is the source element's own range, with
   * `data-td-highlight-text` carrying the latest text so subsequent
   * passes can update in place. Falls back to `adjacent` when the
   * browser does not expose `CSS.highlights`.
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

    // PRE-RENDER DEDUP: SPA frameworks (Next.js App Router, React 18
    // hydration) often re-wrap the same logical block in new nodes
    // between renders. Strict `:scope > .td-translation` selectors miss
    // the previous translation once it has been moved under a wrapper.
    // Look up the element-level registry first; fall back to scanning
    // the whole subtree; remove every other translation so we end up
    // with exactly one.
    const existing = dedupSourceTranslations(sourceElement);

    // Stable id so the MutationObserver can recognize re-rendered
    // nodes that still carry an existing translation. The data
    // attribute is harmless to the page and survives virtual DOM
    // diffing.
    if (!sourceElement.hasAttribute('data-td-block-id')) {
      sourceElement.setAttribute('data-td-block-id', sourceBlock.id);
    }

    if (useHighlight) {
      // L6 path: no DOM wrapper, just register a Highlight and store
      // the latest translated text in a data attribute. The
      // `insertTranslation` helper handles the cleanup of the
      // previous highlight via the same element-level registry used
      // by the DOM strategy.
      const previousHighlighted = sourceElement.getAttribute('data-td-highlight-text');
      if (previousHighlighted !== translation.translatedText) {
        // Only re-insert when the text actually changed; otherwise
        // re-appending the same Highlight is a no-op that still
        // touches the layout pipeline.
        insertTranslation(sourceElement, translation.translatedText, targetLanguage, 'highlight');
      }
      continue;
    }

    ensureSourceWrapper(sourceElement);
    const ownerDocument = sourceElement.ownerDocument ?? globalThis.document;
    if (!ownerDocument) continue;
    const translatedElement = existing || ownerDocument.createElement('span');
    translatedElement.className = TRANSLATION_CLASS;
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
  root.querySelectorAll<HTMLElement>(`.${TRANSLATION_CLASS}`).forEach((element) => element.remove());
  root.querySelectorAll<HTMLElement>(`.${SOURCE_CLASS}`).forEach((wrapper) => {
    const parent = wrapper.parentNode;
    if (!parent) return;
    while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
    wrapper.remove();
  });
  // L6: any element that opted into the highlight strategy carries a
  // `data-td-highlight-text` attribute; ask the strategy helper to
  // drop the corresponding Highlight from `CSS.highlights` and strip
  // the data attribute so the next scan starts from a clean slate.
  root.querySelectorAll<HTMLElement>('[data-td-highlight-text]').forEach((element) => {
    removeInsertedTranslation(element, 'highlight');
  });
  // The element-level registry is a WeakMap keyed by detached elements;
  // when the source elements are GC'd, their registry entries drop
  // automatically. We do not need to clear the map explicitly here.
}

function ensureSourceWrapper(sourceElement: HTMLElement): void {
  if (sourceElement.querySelector(`:scope > .${SOURCE_CLASS}`)) return;
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
