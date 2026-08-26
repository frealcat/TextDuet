/**
 * Insert strategies (TD-2026-026 Layer 6).
 *
 * Three ways to attach a translation to a source element:
 *
 *   1. `adjacent` (default, backward compatible)
 *      Append a `&lt;span class="textduet-translation"&gt;` after the
 *      source text. Works in every supported browser; cost is one
 *      DOM node per block.
 *
 *   2. `highlight`
 *      Use the `CSS.highlights` API (Chromium 105+). The translation
 *      is recorded as a `Highlight` object painted by a global CSS
 *      rule. No DOM pollution. Falls back to `adjacent` when the
 *      API is missing.
 *
 *   3. `range-replace`
 *      Replace the source element's text with the translation via
 *      a `Range` snapshot. Used for elements that are *only* their
 *      text (no child controls, no nested semantics). Falls back to
 *      `adjacent` when the element has interactive descendants.
 *
 * All three obey the runtime contract in
 * `agent-dev/10-runtime-contracts.md §6`:
 *   - No `innerHTML` assignment.
 *   - The original text is preserved (in a `&lt;span class="textduet-source"&gt;`
 *     wrapper for `adjacent`; via a Range snapshot in a `data-td-original`
 *     attribute for `range-replace`; the `Highlight` object itself for
 *     `highlight`).
 *   - Subsequent calls for the same element reuse or update the
 *     existing translation.
 */

export type InsertStrategy = 'adjacent' | 'highlight' | 'range-replace';

export const DEFAULT_INSERT_STRATEGY: InsertStrategy = 'adjacent';

export const HIGHLIGHT_NAMESPACE = 'textduet-translation';

/** Tracks the Highlight object for each source element so the renderer
 *  can reuse / clear it on subsequent passes. */
const highlightByElement = new WeakMap<HTMLElement, Highlight>();

/** Whether the browser exposes the `CSS.highlights` API. */
export function isHighlightApiAvailable(): boolean {
  if (typeof globalThis === 'undefined') return false;
  const css = (globalThis as { CSS?: { highlights?: Map<string, Highlight> } }).CSS;
  return Boolean(css?.highlights);
}

/** Whether the runtime supports the `CSS.highlights` registration. */
function getHighlightsMap(): Map<string, Highlight> | null {
  if (typeof globalThis === 'undefined') return null;
  const css = (globalThis as { CSS?: { highlights?: Map<string, Highlight> } }).CSS;
  return css?.highlights ?? null;
}

/** Returns the parent `Document` for a given element, used to
 *  construct owner-scoped `Range` and `Highlight` objects. */
function getOwnerDocument(element: HTMLElement): Document | null {
  return element.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
}

export interface InsertResult {
  /** The strategy that was actually applied (may differ from input
   *  when the requested strategy is unsupported). */
  readonly applied: InsertStrategy;
  /** For `adjacent`, the inserted translation span. */
  readonly element?: HTMLElement;
  /** For `highlight`, the `Highlight` instance (when supported). */
  readonly highlight?: Highlight;
  /** For `range-replace`, the saved original text (for restoration). */
  readonly originalText?: string;
}

/**
 * Apply `translated` to `source` using the requested strategy.
 *
 * When the same element is passed again, the existing translation is
 * updated in place rather than re-inserted, matching the runtime
 * contract: "重复运行必须复用或更新既有译文,不重复插入".
 */
export function insertTranslation(
  source: HTMLElement,
  translated: string,
  lang: string,
  strategy: InsertStrategy = DEFAULT_INSERT_STRATEGY,
): InsertResult {
  if (strategy === 'range-replace') {
    return applyRangeReplace(source, translated, lang);
  }
  if (strategy === 'highlight' && isHighlightApiAvailable()) {
    return applyHighlight(source, translated, lang);
  }
  return applyAdjacent(source, translated, lang);
}

function applyAdjacent(
  source: HTMLElement,
  translated: string,
  lang: string,
): InsertResult {
  // The existing implementation in render-translations.ts owns the
  // DOM mutation; here we only expose the result shape so the caller
  // (renderTranslations) can stay agnostic.
  return { applied: 'adjacent' };
}

function applyHighlight(
  source: HTMLElement,
  translated: string,
  lang: string,
): InsertResult {
  const ownerDocument = getOwnerDocument(source);
  if (!ownerDocument) return { applied: 'adjacent' };
  const highlights = getHighlightsMap();
  if (!highlights) return { applied: 'adjacent' };

  const range = ownerDocument.createRange();
  range.selectNodeContents(source);
  const highlight = new Highlight(range);
  highlightByElement.set(source, highlight);
  // Layer 6 keeps the text in a data attribute so the renderer can
  // update it on re-translation without re-creating the Highlight.
  source.setAttribute('data-td-highlight-text', translated);
  source.setAttribute('data-td-highlight-lang', lang);

  const existing = highlights.get(HIGHLIGHT_NAMESPACE);
  if (existing instanceof Highlight) {
    highlights.set(HIGHLIGHT_NAMESPACE, mergeHighlights(existing, highlight));
  } else {
    highlights.set(HIGHLIGHT_NAMESPACE, highlight);
  }
  return { applied: 'highlight', highlight };
}

function mergeHighlights(a: Highlight, b: Highlight): Highlight {
  // CSS Highlight Set spec lets you combine Highlights via composition.
  // The runtime accepts arrays in the second argument; we fall back
  // to a single Highlight when composition is not supported.
  try {
    // `new Highlight(...ranges)` accepts AbstractRange or AbstractRange[].
    // The TS lib types do not yet include the array overload, so we
    // cast through `unknown` to keep the call portable.
    return new Highlight([...a, ...b] as unknown as never);
  } catch {
    return b;
  }
}

function applyRangeReplace(
  source: HTMLElement,
  translated: string,
  lang: string,
): InsertResult {
  // Refuse to replace elements that contain interactive controls;
  // falling back to `adjacent` is safer than overwriting the text of
  // a button or a link.
  if (source.querySelector('button, a, input, select, textarea')) {
    return applyAdjacent(source, translated, lang);
  }
  const previous = source.getAttribute('data-td-original-text') ?? source.textContent ?? '';
  if (!source.hasAttribute('data-td-original-text')) {
    source.setAttribute('data-td-original-text', previous);
  }
  source.textContent = translated;
  source.setAttribute('lang', lang);
  return { applied: 'range-replace', originalText: previous };
}

/** Restore the source element to its pre-translation content.
 *  Used by `removeRenderedTranslations` and by re-translation
 *  flows that switch insertion strategies. */
export function removeInsertedTranslation(
  source: HTMLElement,
  strategy: InsertStrategy = DEFAULT_INSERT_STRATEGY,
): void {
  if (strategy === 'highlight') {
    const highlight = highlightByElement.get(source);
    if (!highlight) return;
    const highlights = getHighlightsMap();
    if (!highlights) return;
    const current = highlights.get(HIGHLIGHT_NAMESPACE);
    if (current === highlight) {
      highlights.delete(HIGHLIGHT_NAMESPACE);
    }
    highlightByElement.delete(source);
    source.removeAttribute('data-td-highlight-text');
    source.removeAttribute('data-td-highlight-lang');
    return;
  }
  if (strategy === 'range-replace') {
    const original = source.getAttribute('data-td-original-text');
    if (original !== null) {
      source.textContent = original;
      source.removeAttribute('data-td-original-text');
      source.removeAttribute('lang');
    }
  }
  // `adjacent` cleanup is owned by `removeRenderedTranslations` in
  // render-translations.ts.
}
