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
 *      Register the source range with the `CSS.highlights` API (Chromium
 *      105+). Custom Highlights cannot render replacement text, so the
 *      visible translation remains the adjacent plain-text span owned by
 *      `render-translations.ts`. Falls back to `adjacent` when unsupported.
 *
 *   3. `range-replace`
 *      Replace the source element's text with the translation via
 *      a `Range` snapshot. Used for elements that are *only* their
 *      text (no child controls, no nested semantics). Falls back to
 *      `adjacent` when the element has interactive descendants.
 *
 * All three obey TextDuet's runtime safety contract:
 *   - No `innerHTML` assignment.
 *   - The original text is preserved (in a `&lt;span class="textduet-source"&gt;`
 *     wrapper for `adjacent`; via a Range snapshot in a `data-td-original`
 *     attribute for `range-replace`; the source range plus adjacent span for
 *     `highlight`).
 *   - Subsequent calls for the same element reuse or update the
 *     existing translation.
 */

import { SOURCE_CLASS, TRANSLATION_CLASS } from './page-status';

export type InsertStrategy = 'adjacent' | 'highlight' | 'range-replace';

export const DEFAULT_INSERT_STRATEGY: InsertStrategy = 'adjacent';

export const HIGHLIGHT_NAMESPACE = 'textduet-translation';

/**
 * A WeakMap keeps the range associated with its source without retaining a
 * detached page node. The weak-reference set is only an iterable index used
 * while rebuilding the document-level aggregate; dead references are pruned
 * on every rebuild.
 */
const highlightRangeByElement = new WeakMap<HTMLElement, Range>();
const highlightElementRefs = new Set<WeakRef<HTMLElement>>();
const highlightRefByElement = new WeakMap<HTMLElement, WeakRef<HTMLElement>>();
let highlightDocument: Document | null = null;

/**
 * `textContent = ...` removes all child nodes from the source element. Keep
 * the original node references so a strategy switch can restore the exact DOM
 * structure (including comments, adjacent text nodes, and event-bound nodes),
 * rather than reconstructing a lossy `textContent` string.
 */
interface RangeReplaceSnapshot {
  readonly childNodes: Node[];
  readonly hadLangAttribute: boolean;
  readonly originalLang: string | null;
}

const rangeReplaceSnapshotByElement = new WeakMap<HTMLElement, RangeReplaceSnapshot>();

type HighlightConstructor = new (...ranges: Range[]) => Highlight;

function getHighlightConstructor(): HighlightConstructor | null {
  if (typeof globalThis === 'undefined') return null;
  const candidate = (globalThis as { Highlight?: unknown }).Highlight;
  return typeof candidate === 'function'
    ? candidate as HighlightConstructor
    : null;
}

/** Whether the browser exposes the `CSS.highlights` API. */
export function isHighlightApiAvailable(): boolean {
  return Boolean(getHighlightConstructor() && getHighlightsMap());
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
  const HighlightCtor = getHighlightConstructor();
  if (!highlights || !HighlightCtor) return { applied: 'adjacent' };

  resetHighlightDocument(ownerDocument, highlights);

  // A source can move directly between insertion strategies after a SPA
  // remount or an Options change. Restore range-replaced content before taking
  // a highlight snapshot, otherwise the translated text would become the new
  // source and the original would be lost.
  removeInsertedTranslation(source, 'range-replace');

  const ranges = createSourceRanges(ownerDocument, source);
  if (ranges.length === 0) {
    // Text can disappear between scans (for example when a virtualized row is
    // cleared). Remove any prior source registration and attributes before
    // returning the adjacent fallback; otherwise the old range remains
    // painted and the next render incorrectly treats the source as active.
    unregisterHighlightElement(source);
    source.removeAttribute('data-td-highlight-text');
    source.removeAttribute('data-td-highlight-lang');
    rebuildHighlightRegistry(highlights, HighlightCtor);
    return { applied: 'adjacent' };
  }
  highlightRangeByElement.set(source, ranges[0]!);
  sourceRangesByElement.set(source, ranges);
  registerHighlightElement(source);
  // Layer 6 keeps the text in a data attribute so the renderer can
  // update it on re-translation without re-creating the Highlight.
  source.setAttribute('data-td-highlight-text', translated);
  source.setAttribute('data-td-highlight-lang', lang);

  const highlight = rebuildHighlightRegistry(highlights, HighlightCtor);
  if (!highlight) {
    // A browser can expose the API while rejecting a particular range (for
    // example after a framework detaches/replaces its text node). Remove the
    // failed registration and attributes so the caller can safely render the
    // adjacent fallback and retry on the next scan.
    unregisterHighlightElement(source);
    source.removeAttribute('data-td-highlight-text');
    source.removeAttribute('data-td-highlight-lang');
    // Keep an already-valid sibling aggregate intact when this source cannot
    // be represented by the host Highlight implementation.
    rebuildHighlightRegistry(highlights, HighlightCtor);
    return { applied: 'adjacent' };
  }
  return { applied: 'highlight', highlight };
}

function resetHighlightDocument(
  ownerDocument: Document,
  highlights: Map<string, Highlight>,
): void {
  if (highlightDocument === null || highlightDocument === ownerDocument) {
    highlightDocument = ownerDocument;
    return;
  }
  // CSS.highlights is scoped to the active document. Do not combine ranges
  // from a detached/previous document with the current page's aggregate.
  clearHighlightRegistry(highlights);
  highlightDocument = ownerDocument;
}

/** Selects source text without allowing an existing adjacent translation into
 * the custom Highlight range when a legacy/unwrapped source is encountered. */
/**
 * CSS Highlights cannot render replacement text and must never include one of
 * TextDuet's own translation spans in the source range. Build ranges from
 * text nodes instead of selecting a broad parent interval; this also avoids
 * accidentally painting a nested candidate's adjacent translation.
 */
function createSourceRanges(ownerDocument: Document, source: HTMLElement): Range[] {
  const sourceRoot = findSourceRoot(source);
  const textNodes: Text[] = [];
  const visit = (node: Node): void => {
    if (node.nodeType === 1) {
      const element = node as Element;
      if (element.matches?.(`.${TRANSLATION_CLASS}`)) return;
    }
    if (node.nodeType === 3) {
      if ((node.nodeValue ?? '').length > 0) textNodes.push(node as Text);
      return;
    }
    node.childNodes.forEach(visit);
  };
  visit(sourceRoot);
  return textNodes.map((textNode) => {
    const range = ownerDocument.createRange();
    // `selectNode` is supported by Chrome and by lightweight DOMs such as
    // linkedom; unlike `setStart`/`setEnd`, it also works in test realms that
    // intentionally expose only the portable Range surface.
    range.selectNode(textNode);
    return range;
  });
}

function findSourceRoot(source: HTMLElement): HTMLElement {
  const direct = source.querySelector<HTMLElement>(`:scope > .${SOURCE_CLASS}`);
  return direct ?? source;
}

/** All ranges belonging to a source; kept weakly by element. */
const sourceRangesByElement = new WeakMap<HTMLElement, Range[]>();

function registerHighlightElement(source: HTMLElement): void {
  if (highlightRefByElement.has(source)) return;
  const ref = new WeakRef(source);
  highlightRefByElement.set(source, ref);
  highlightElementRefs.add(ref);
}

function unregisterHighlightElement(source: HTMLElement): void {
  const ref = highlightRefByElement.get(source);
  if (ref) highlightElementRefs.delete(ref);
  highlightRefByElement.delete(source);
  highlightRangeByElement.delete(source);
  sourceRangesByElement.delete(source);
}

function rebuildHighlightRegistry(
  highlights: Map<string, Highlight>,
  HighlightCtor: HighlightConstructor,
): Highlight | null {
  // Detached nodes can outlive the page's DOM references. Prune them while
  // rebuilding so the registry does not retain stale ranges indefinitely.
  const ranges: Range[] = [];
  for (const ref of [...highlightElementRefs]) {
    const element = ref.deref();
    if (!element) {
      highlightElementRefs.delete(ref);
      continue;
    }
    if (!isElementConnected(element)) {
      unregisterHighlightElement(element);
      element.removeAttribute('data-td-highlight-text');
      element.removeAttribute('data-td-highlight-lang');
      continue;
    }
    const elementRanges = sourceRangesByElement.get(element);
    const firstRange = highlightRangeByElement.get(element);
    if (elementRanges?.length) ranges.push(...elementRanges);
    else if (firstRange) ranges.push(firstRange);
  }
  if (ranges.length === 0) {
    highlights.delete(HIGHLIGHT_NAMESPACE);
    return null;
  }
  try {
    const highlight = new HighlightCtor(...ranges);
    highlights.set(HIGHLIGHT_NAMESPACE, highlight);
    return highlight;
  } catch {
    // Keep the previous aggregate if it was valid. The caller removes the
    // newly-added source and retries the rebuild, which makes failure local
    // and preserves unrelated translations on the page.
    return null;
  }
}

function clearHighlightRegistry(highlights: Map<string, Highlight>): void {
  highlights.delete(HIGHLIGHT_NAMESPACE);
  for (const ref of [...highlightElementRefs]) {
    const element = ref.deref();
    if (element) {
      element.removeAttribute('data-td-highlight-text');
      element.removeAttribute('data-td-highlight-lang');
      unregisterHighlightElement(element);
    } else {
      highlightElementRefs.delete(ref);
    }
  }
  highlightDocument = null;
}

function isElementConnected(element: HTMLElement): boolean {
  if (element.isConnected !== undefined) return element.isConnected;
  const root = element.ownerDocument?.documentElement;
  return Boolean(root?.contains(element));
}

function applyRangeReplace(
  source: HTMLElement,
  translated: string,
  lang: string,
): InsertResult {
  // Refuse to replace elements that contain interactive controls;
  // falling back to `adjacent` is safer than overwriting the text of
  // a button or a link.
  // Replacing `textContent` destroys every descendant node, including benign
  // semantic markup such as `<em>` or `<strong>`. Restrict this experimental
  // strategy to genuinely text-only elements; any descendant element uses the
  // adjacent renderer, which preserves page structure and controls.
  if (isInteractiveElement(source) || source.children.length > 0) {
    return applyAdjacent(source, translated, lang);
  }
  const previous = source.getAttribute('data-td-original-text') ?? source.textContent ?? '';
  if (!source.hasAttribute('data-td-original-text')) {
    rangeReplaceSnapshotByElement.set(source, {
      childNodes: [...source.childNodes],
      hadLangAttribute: source.hasAttribute('lang'),
      originalLang: source.getAttribute('lang'),
    });
    source.setAttribute('data-td-original-text', previous);
  }
  source.textContent = translated;
  source.setAttribute('lang', lang);
  return { applied: 'range-replace', originalText: previous };
}

const RANGE_REPLACE_INTERACTIVE_SELECTOR = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'summary',
  'option',
  'optgroup',
  'form',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="combobox"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[role="radio"]',
  '[role="search"]',
  '[role="searchbox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="textbox"]',
].join(', ');

function isInteractiveElement(source: HTMLElement): boolean {
  try {
    return source.matches(RANGE_REPLACE_INTERACTIVE_SELECTOR)
      || Boolean(source.querySelector(RANGE_REPLACE_INTERACTIVE_SELECTOR));
  } catch {
    // The selector is static and valid in supported Chrome; fail closed if a
    // host DOM implementation cannot parse it.
    return true;
  }
}

/** Restore the source element to its pre-translation content.
 *  Used by `removeRenderedTranslations` and by re-translation
 *  flows that switch insertion strategies. */
export function removeInsertedTranslation(
  source: HTMLElement,
  strategy: InsertStrategy = DEFAULT_INSERT_STRATEGY,
): void {
  if (strategy === 'highlight') {
    unregisterHighlightElement(source);
    const highlights = getHighlightsMap();
    const HighlightCtor = getHighlightConstructor();
    if (highlights && HighlightCtor) {
      rebuildHighlightRegistry(highlights, HighlightCtor);
    } else if (highlights) {
      highlights.delete(HIGHLIGHT_NAMESPACE);
    }
    source.removeAttribute('data-td-highlight-text');
    source.removeAttribute('data-td-highlight-lang');
    return;
  }
  if (strategy === 'range-replace') {
    const original = source.getAttribute('data-td-original-text');
    const snapshot = rangeReplaceSnapshotByElement.get(source);
    if (original !== null || snapshot) {
      if (snapshot) {
        // Reattach the original nodes instead of cloning or reparsing them;
        // this preserves node identity and any listeners attached by the host
        // page. `replaceChildren` safely detaches the temporary translation
        // text node before restoring the saved structure.
        source.replaceChildren(...snapshot.childNodes);
        if (snapshot.hadLangAttribute) {
          if (snapshot.originalLang === null) source.setAttribute('lang', '');
          else source.setAttribute('lang', snapshot.originalLang);
        } else {
          source.removeAttribute('lang');
        }
      } else {
        // Legacy/serialized output has only the text marker available. Keep
        // the backwards-compatible text restoration fallback for that case.
        source.textContent = original ?? '';
        source.removeAttribute('lang');
      }
      source.removeAttribute('data-td-original-text');
      rangeReplaceSnapshotByElement.delete(source);
    }
  }
  // `adjacent` cleanup is owned by `removeRenderedTranslations` in
  // render-translations.ts.
}
