import type { TranslationBlock } from '@/src/core/contracts';
import {
  planTranslationBlock,
  pruneAncestorCandidates,
} from '@/src/core/translation-planning';
import { getRuleRootElements, type SiteRule } from './site-rules';
import {
  SOURCE_BLOCK_ID_ATTRIBUTE,
  SOURCE_CLASS,
  SELECTION_ERROR_CLASS,
  SELECTION_QUICK_ACTION_CLASS,
  SELECTION_TRANSLATION_CLASS,
  TRANSLATION_CLASS,
} from './page-status';

/**
 * Reading containers keep their prose candidate even when an inline control
 * or hidden node is present. The descendant is removed from the text
 * snapshot, while the semantic boundary preserves the surrounding prose.
 */
export const TRANSLATION_SEMANTIC_READING_SELECTOR = [
  'h1, h2, h3, h4, h5, h6, p, li, blockquote, td, figcaption',
  'article, [role="article"], [role="listitem"]',
].join(', ');

export const TRANSLATION_BLOCK_SELECTOR =
  [
    // Top-level text containers. The list starts with semantic elements
    // (h1-h6, p, li, blockquote, td, figcaption) which most sites emit.
    // `<a>` is intentionally NOT in the top-level: in body content the
    // anchor text is almost always part of a longer sentence ("see
    // our <a>terms</a>"), and translating the link as its own one-word
    // block would split the parent paragraph into per-word fragments.
    // Navigation links in header / nav / footer / aside are still
    // collected via the shell-specific selectors below, where the link
    // is the entire block label and a one-word translation is correct.
    TRANSLATION_SEMANTIC_READING_SELECTOR,
    'span, div, section',
    // Navigation and shell copy is useful reading content too. Keep the
    // selector narrow. Interactive controls are excluded independently
    // below, even when they sit inside one of these landmarks.
    'header a, header p, header li, header h1, header h2, header h3, header h4, header h5, header h6',
    'header span, header div, header section',
    'nav a, [role="navigation"] a',
    'nav span, nav div, nav section',
    'footer a, footer p, footer li, footer h1, footer h2, footer h3, footer h4, footer h5, footer h6',
    'footer span, footer div, footer section',
    // Sidebar / complementary content (forum nav, doc TOC, settings panels)
    // is also part of the page shell users want translated. Sites with
    // sidebar widgets that should NOT be translated (e.g. doc-side TOC in
    // framework-docs) opt out via site rule's `excludedSelectors`.
    'aside a, aside p, aside li, aside h1, aside h2, aside h3, aside h4, aside h5, aside h6',
    'aside span, aside div, aside section',
    // Sites that do not use the semantic <header> / <footer> tags rely on
    // ARIA landmarks. The WAI-ARIA spec maps role="banner" to <header>,
    // role="contentinfo" to <footer>, and role="complementary" to <aside>;
    // sites that follow the spec still expose these roles regardless of
    // the tag they pick. Adding the role selectors covers Gatsby / Next /
    // custom shells that use <div role>.
    '[role="banner"] a, [role="banner"] p, [role="banner"] li, [role="banner"] h1, [role="banner"] h2, [role="banner"] h3, [role="banner"] h4, [role="banner"] h5, [role="banner"] h6',
    '[role="banner"] span, [role="banner"] div, [role="banner"] section',
    '[role="contentinfo"] a, [role="contentinfo"] p, [role="contentinfo"] li, [role="contentinfo"] h1, [role="contentinfo"] h2, [role="contentinfo"] h3, [role="contentinfo"] h4, [role="contentinfo"] h5, [role="contentinfo"] h6',
    '[role="contentinfo"] span, [role="contentinfo"] div, [role="contentinfo"] section',
    '[role="complementary"] a, [role="complementary"] p, [role="complementary"] li, [role="complementary"] h1, [role="complementary"] h2, [role="complementary"] h3, [role="complementary"] h4, [role="complementary"] h5, [role="complementary"] h6',
    '[role="complementary"] span, [role="complementary"] div, [role="complementary"] section',
  ].join(', ');

/**
 * Interactive controls are not reading content. Keep this selector separate
 * from the broader non-reading exclusion list so container candidates
 * such as a bare SPA `<div>` can be rejected when their text comes from a
 * nested control. This prevents us from translating a button indirectly by
 * translating its wrapper.
 *
 * Links are deliberately absent: a paragraph may legitimately contain an
 * inline link, and shell links are useful navigation labels to translate.
 */
export const TRANSLATION_INTERACTIVE_CONTROL_SELECTOR = [
  'button',
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

/**
 * These descendants must not leak through a generic candidate's aggregated
 * `textContent`. They are intentionally narrower than the complete hard
 * exclusion list: code/pre need a dedicated text-extraction policy because
 * inline code can coexist with readable prose, whereas hidden/control text
 * is never safe to send as part of a parent container.
 */
export const TRANSLATION_NON_READING_DESCENDANT_SELECTOR = [
  TRANSLATION_INTERACTIVE_CONTROL_SELECTOR,
  '[aria-hidden="true"]',
  '[hidden]',
  '[inert]',
].join(', ');

/** TextDuet output is never page-owned source text. Source wrappers are kept
 * because they contain the original page text needed for bilingual display. */
const TRANSLATION_OUTPUT_SELECTOR = [
  `.${TRANSLATION_CLASS}`,
  `.${SELECTION_TRANSLATION_CLASS}`,
  `.${SELECTION_ERROR_CLASS}`,
  `.${SELECTION_QUICK_ACTION_CLASS}`,
  '#textduet-styles',
].join(', ');

/** Every node created by the in-page TextDuet runtime, never page content. */
const TEXTDUET_OWNED_DOM_SELECTOR = [
  `.${SOURCE_CLASS}`,
  `.${TRANSLATION_CLASS}`,
  `.${SELECTION_TRANSLATION_CLASS}`,
  `.${SELECTION_ERROR_CLASS}`,
  `.${SELECTION_QUICK_ACTION_CLASS}`,
].join(', ');
const TEXTDUET_MANAGED_SOURCE_SELECTOR = `[${SOURCE_BLOCK_ID_ATTRIBUTE}]`;

export const TRANSLATION_ALWAYS_EXCLUDED_ANCESTOR_SELECTOR = [
  // TextDuet's own DOM is intentionally made from generic spans, which are
  // otherwise valid candidates. A visibility-driven reconciliation scan must
  // never translate the source wrapper or the translated text again: doing so
  // recursively inserts a new translation inside each previous translation.
  // Keep this in the hard self/ancestor exclusion (rather than the generic
  // non-reading-container set) so the real parent paragraph/link remains a
  // valid candidate and no genuine navigation label is lost.
  TEXTDUET_OWNED_DOM_SELECTOR,
  'script',
  'style',
  'noscript',
  'code',
  'pre',
  TRANSLATION_INTERACTIVE_CONTROL_SELECTOR,
  '[aria-hidden="true"]',
  '[hidden]',
  '[inert]',
  '[role="button"]',
  '[role="search"]',
].join(', ');

export const TRANSLATION_NAVIGATION_EXCLUDED_ANCESTOR_SELECTOR = [
  'menu',
  '[role="menu"]',
  '[aria-label*="breadcrumb" i]',
  '[class~="breadcrumbs"]',
].join(', ');

export const TRANSLATION_EXCLUDED_ANCESTOR_SELECTOR = [
  TRANSLATION_ALWAYS_EXCLUDED_ANCESTOR_SELECTOR,
  TRANSLATION_NAVIGATION_EXCLUDED_ANCESTOR_SELECTOR,
].join(', ');

export interface TranslationDomCandidate extends TranslationBlock {
  element: HTMLElement;
}

/**
 * Returns whether a node contains content that must not enter a Provider
 * request. This is separate from candidate eligibility: semantic containers
 * can remain eligible while their control/hidden descendants are removed.
 */
export function hasTranslationTextExclusions(element: HTMLElement): boolean {
  try {
    return element.matches(
      `${TRANSLATION_NON_READING_DESCENDANT_SELECTOR}, ${TRANSLATION_OUTPUT_SELECTOR}`,
    ) || element.querySelector(
      `${TRANSLATION_NON_READING_DESCENDANT_SELECTOR}, ${TRANSLATION_OUTPUT_SELECTOR}`,
    ) !== null;
  } catch {
    // The built-in selectors are static and valid in Chrome. Returning false
    // here leaves the caller's existing text extractor as the fallback for a
    // non-standard DOM implementation rather than aborting a full scan.
    return false;
  }
}

/**
 * Clone a candidate and remove non-reading descendants plus TextDuet output.
 * The source wrapper itself is intentionally retained: it is the original
 * page text, not generated output. Callers can safely read `innerText` or
 * `textContent` from the returned clone without mutating the live page.
 */
export function extractReadableText(element: HTMLElement): string {
  let clone: HTMLElement;
  try {
    clone = element.cloneNode(true) as HTMLElement;
    if (clone.matches(
      `${TRANSLATION_NON_READING_DESCENDANT_SELECTOR}, ${TRANSLATION_OUTPUT_SELECTOR}`,
    )) {
      return '';
    }
    clone.querySelectorAll(
      `${TRANSLATION_NON_READING_DESCENDANT_SELECTOR}, ${TRANSLATION_OUTPUT_SELECTOR}`,
    ).forEach((node) => node.remove());
  } catch {
    // Keep extraction total for lightweight DOM implementations. The caller
    // can still use the original text callback when cloning/selectors fail.
    return '';
  }
  const innerText = (clone as HTMLElement & { innerText?: string }).innerText;
  return innerText !== undefined ? innerText : clone.textContent || '';
}

interface CollectTranslationCandidatesOptions {
  getId: (element: HTMLElement) => string;
  getText: (element: HTMLElement) => string;
  isVisible?: (element: HTMLElement) => boolean;
  siteRule?: SiteRule | null;
}

/**
 * Build the site-rule header / footer extra selector block. Each extra
 * string is treated as a host selector (e.g. `.site-header`) and we append
 * the same conservative descendant pattern that the default block
 * selector uses for `<header>` / `<footer>`. Invalid or empty inputs are
 * silently dropped so a bad site rule cannot break the whole extractor.
 */
function buildSiteRuleHeaderFooterExtras(rule: SiteRule | null | undefined): string {
  if (!rule) return '';
  const textChildren = [
    'a', 'p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'span', 'div',
  ];
  const parts: string[] = [];
  for (const extra of rule.headerExtras || []) {
    if (typeof extra !== 'string' || !extra.trim()) continue;
    for (const child of textChildren) {
      parts.push(`${extra} ${child}`);
    }
  }
  for (const extra of rule.footerExtras || []) {
    if (typeof extra !== 'string' || !extra.trim()) continue;
    for (const child of textChildren) {
      parts.push(`${extra} ${child}`);
    }
  }
  return parts.join(', ');
}

/** Collects the conservative reading-text subset shared by runtime and browser acceptance. */
export function collectTranslationCandidates(
  document: Document,
  options: CollectTranslationCandidatesOptions,
): TranslationDomCandidate[] {
  const isVisible = options.isVisible || isElementVisible;
  const excludedSelector = [
    TRANSLATION_EXCLUDED_ANCESTOR_SELECTOR,
    ...(options.siteRule?.excludedSelectors || []),
  ].join(', ');
  const headerFooterExtras = buildSiteRuleHeaderFooterExtras(options.siteRule);
  const blockSelector = [
    TRANSLATION_BLOCK_SELECTOR,
    headerFooterExtras,
    ...(options.siteRule?.blockSelectors || []),
  ].filter((selector) => selector.length > 0).join(', ');
  const nonReadingContainers = collectNonReadingContainers(document);
  // TreeWalker (Layer 3) replaces the prior `querySelectorAll` + Set
  // dedup. The walker rejects ALWAYS_EXCLUDED subtrees in one pass, so
  // we do not have to inspect every node again in the flatMap below.
  const elements: HTMLElement[] = [];
  const seen = new WeakSet<HTMLElement>();
  for (const root of [
    ...getRuleRootElements(document, options.siteRule ?? null),
    document.documentElement,
  ]) {
    try {
      if (root.matches(blockSelector) && !seen.has(root as HTMLElement)) {
        seen.add(root as HTMLElement);
        elements.push(root as HTMLElement);
      }
    } catch {
      // Invalid block selector — skip this root rather than fail the
      // whole scan. The fallback site rule (`rootSelector` missing)
      // still has documentElement to walk.
    }
    for (const candidate of walkTextCandidates(root, blockSelector)) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      elements.push(candidate);
    }
  }
  const candidates = elements.flatMap((element) => {
    const isExplicitlyIncluded = options.siteRule?.includedSelectors?.some((selector) => {
      try {
        return Boolean(element.closest(selector));
      } catch {
        return false;
      }
    }) ?? false;
    const suppliedText = options.getText(element);
    // Keep custom source-text callbacks for ordinary nodes, but enforce the
    // DOM safety boundary whenever generated output, controls, or hidden
    // descendants are present. This prevents a caller that uses raw
    // `textContent` from accidentally sending action labels to a Provider.
    const text = hasTranslationTextExclusions(element)
      ? extractReadableText(element)
      : suppliedText;
    const block = planTranslationBlock({
      id: options.getId(element),
      text,
      // Controls must never become translation candidates, either directly
      // (a <button> in a shell landmark) or indirectly (a bare SPA <div>
      // whose only text is nested in a button). Site-rule inclusion can
      // override a site-specific exclusion but never this safety boundary.
      isExcluded: hasMatchingSelfOrAncestor(
        element,
        TRANSLATION_ALWAYS_EXCLUDED_ANCESTOR_SELECTOR,
      )
        || hasRenderedSourceBlockAncestor(element)
        || nonReadingContainers.has(element)
        || (
        !isExplicitlyIncluded && hasAncestorMatching(element, excludedSelector)
      ),
      isVisible: isVisible(element),
    });

    return block ? [{ ...block, element }] : [];
  });
  const candidatesByElement = new Map(
    candidates.map((candidate) => [candidate.element, candidate]),
  );

  // A semantic block can contain direct prose plus inline formatting or
  // shell links. In that shape, pruning the semantic parent in favour of a
  // nested span/link would silently drop the parent's direct text. Let the
  // semantic block cover the whole branch; when it has no direct text, the
  // existing deepest-candidate pruning below still preserves independent
  // headings, paragraphs, and badges.
  const candidatesWithSemanticCoverage = candidates.filter((candidate) => {
    let parent = candidate.element.parentElement;
    while (parent) {
      const parentCandidate = candidatesByElement.get(parent);
      if (
        parentCandidate
        && isSemanticReadingContainer(parent)
        && hasDirectReadableText(parent)
      ) {
        return false;
      }
      parent = parent.parentElement;
    }
    return true;
  });
  const prunableCandidatesByElement = new Map(
    candidatesWithSemanticCoverage.map((candidate) => [candidate.element, candidate]),
  );

  return pruneAncestorCandidates(candidatesWithSemanticCoverage, (candidate) => {
    let parent = candidate.element.parentElement;
    while (parent) {
      const parentCandidate = prunableCandidatesByElement.get(parent);
      if (parentCandidate) {
        return parentCandidate;
      }
      parent = parent.parentElement;
    }
    return null;
  });
}

/**
 * Excludes only framework wrappers whose entire readable text comes from
 * TextDuet-owned nodes. A rendered generic block may still receive genuine
 * page children later; those text nodes keep the wrapper eligible (and the
 * normal ancestor-pruning pass selects the new child), preserving zero-miss
 * dynamic content behavior.
 */
function hasRenderedSourceBlockAncestor(element: HTMLElement): boolean {
  let ancestor = element.parentElement;
  while (ancestor) {
    if (ancestor.matches(TEXTDUET_MANAGED_SOURCE_SELECTOR)) {
      return !hasPageOwnedText(element);
    }
    ancestor = ancestor.parentElement;
  }
  return false;
}

function hasPageOwnedText(element: HTMLElement): boolean {
  const visit = (node: Node): boolean => {
    if (node.nodeType === 3) return Boolean(node.nodeValue?.trim());
    // Avoid relying on a realm-specific global Element (linkedom tests and
    // embedded documents may not expose it); nodeType plus matches is enough.
    if (node.nodeType !== 1) return false;
    const childElement = node as HTMLElement;
    if (typeof childElement.matches !== 'function') return false;
    if (childElement.matches(TEXTDUET_OWNED_DOM_SELECTOR)) return false;
    for (const child of Array.from(node.childNodes)) {
      if (visit(child)) return true;
    }
    return false;
  };
  for (const child of Array.from(element.childNodes)) {
    if (visit(child)) return true;
  }
  return false;
}

function isElementVisible(element: HTMLElement): boolean {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return Boolean(
    style &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    rect.width > 0 &&
    rect.height > 0
  );
}

/**
 * Returns true when at least one ancestor of `element` (excluding the
 * element itself) matches the given selector. Used instead of
 * `Element.closest()` so an element explicitly included by the block
 * selector is not excluded by matching itself against the deny list.
 */
function hasAncestorMatching(element: HTMLElement, selector: string): boolean {
  let parent = element.parentElement;
  while (parent) {
    try {
      if (parent.matches(selector)) return true;
    } catch {
      // Invalid selector — treat as no match rather than blowing up the
      // whole scan. The cost of a false negative here is one missing
      // translation, the cost of throwing is the entire page.
    }
    parent = parent.parentElement;
  }
  return false;
}

/** Includes the candidate itself for hard safety exclusions. */
function hasMatchingSelfOrAncestor(element: HTMLElement, selector: string): boolean {
  let current: HTMLElement | null = element;
  while (current) {
    try {
      if (current.matches(selector)) return true;
    } catch {
      // A malformed site selector must not prevent page translation. The
      // built-in control selector is static and valid in supported Chrome.
    }
    current = current.parentElement;
  }
  return false;
}

/**
 * Generic containers may be valid reading blocks on utility-first SPAs. Mark
 * non-semantic ancestors of an interactive or hidden descendant once per
 * scan: their aggregate text would otherwise translate a control label or
 * leak hidden text. Semantic reading boundaries (for example a `<p>` or
 * `<article>`) remain candidates; their text snapshot strips the unsafe
 * descendants. This one-pass marking avoids a `querySelector` call for every
 * span/div/section candidate on a large page.
 */
function collectNonReadingContainers(document: Document): WeakSet<HTMLElement> {
  const containers = new WeakSet<HTMLElement>();
  try {
    document.querySelectorAll<HTMLElement>(TRANSLATION_NON_READING_DESCENDANT_SELECTOR).forEach((control) => {
      let parent = control.parentElement;
      while (parent) {
        // A semantic reading element may contain an inline control without
        // losing the surrounding prose. Generic ancestors remain excluded so
        // a bare wrapper cannot aggregate and translate the control label.
        if (!isSemanticReadingContainer(parent)) {
          containers.add(parent);
        }
        parent = parent.parentElement;
      }
    });
  } catch {
    // The built-in selector is static and valid in Chrome. If a non-standard
    // DOM implementation rejects it, conservatively fall back to the
    // self/ancestor hard exclusion already applied above.
  }
  return containers;
}

function isSemanticReadingContainer(element: HTMLElement): boolean {
  try {
    return element.matches(TRANSLATION_SEMANTIC_READING_SELECTOR);
  } catch {
    return false;
  }
}

/** Returns true when a semantic candidate owns visible text directly. */
function hasDirectReadableText(element: HTMLElement): boolean {
  return Array.from(element.childNodes).some((node) => (
    node.nodeType === 3 && Boolean(node.nodeValue?.trim())
  ));
}

/**
 * Generator-based DOM walk that visits every element under `root`
 * matching `selector`. Used by the Layer 3 TreeWalker optimisation
 * to avoid the upfront `querySelectorAll` array allocation; on a
 * 10k-node page this is roughly an order of magnitude faster than
 * the equivalent querySelectorAll + filter pass.
 *
 * The walker uses `createTreeWalker` with `NodeFilter.SHOW_ELEMENT`
 * to skip text/comment nodes. The `acceptNode` callback rejects
 * subtrees that match `skipSubtreeSelector` so we never walk into
 * `<script>` / `<style>` / `<noscript>` / form / input containers.
 *
 * Compatibility note: the test environment (linkedom 0.18) does not
 * honour `NodeFilter.FILTER_SKIP` / `FILTER_REJECT` correctly — the
 * underlying walker still yields every element regardless of the
 * acceptNode return value. We therefore double-check the result in
 * the generator loop: any element whose `acceptNode` returned a
 * skip verdict is dropped on the consumer side. This adds at most one
 * O(n) extra `matches` call per candidate (constant time) and keeps
 * the implementation portable between browser DOM and linkedom.
 */
export function* walkTextCandidates(
  root: ParentNode,
  selector: string,
  skipSubtreeSelector: string = TRANSLATION_ALWAYS_EXCLUDED_ANCESTOR_SELECTOR,
): Generator<HTMLElement> {
  const doc = root.nodeType === 9 ? (root as Document) : root.ownerDocument;
  if (!doc || typeof (doc as Document).createTreeWalker !== 'function') {
    // TreeWalker is not available (very old browser or non-DOM env);
    // fall back to a plain querySelectorAll + JS filter pass.
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
      if (hasMatchingSelfOrAncestor(el, skipSubtreeSelector)) continue;
      try {
        if (el.matches(selector)) yield el;
      } catch {
        // Selector does not match this element; skip silently.
      }
    }
    return;
  }
  const walker = (doc as Document).createTreeWalker(
    root,
    0x1 /* NodeFilter.SHOW_ELEMENT */,
    {
      acceptNode(node) {
        // Reject the complete subtree for hard exclusions. The generator
        // below repeats the check because linkedom historically ignored
        // FILTER_REJECT, while Chrome uses it to avoid walking large code,
        // control, hidden, and TextDuet-owned subtrees.
        return hasMatchingSelfOrAncestor(
          node as HTMLElement,
          skipSubtreeSelector,
        )
          ? 0x2 /* NodeFilter.FILTER_REJECT */
          : 0x1 /* NodeFilter.FILTER_ACCEPT */;
      },
    },
  );
  let current: Node | null = walker.nextNode();
  while (current) {
    const element = current as HTMLElement;
    if (hasMatchingSelfOrAncestor(element, skipSubtreeSelector)) {
      current = walker.nextNode();
      continue;
    }
    try {
      if (element.matches(selector)) {
        yield element;
      }
    } catch {
      // Selector does not match this element; skip silently.
    }
    current = walker.nextNode();
  }
}
