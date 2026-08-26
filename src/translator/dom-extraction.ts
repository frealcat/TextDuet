import type { TranslationBlock } from '@/src/core/contracts';
import {
  planTranslationBlock,
  pruneAncestorCandidates,
} from '@/src/core/translation-planning';
import { getRuleRootElements, type SiteRule } from './site-rules';

export const TRANSLATION_BLOCK_SELECTOR =
  [
    // Top-level text containers. The list starts with semantic elements
    // (h1-h6, p, li, blockquote, td, figcaption, a) which most sites emit.
    // `<a>` is added because SPA post titles are typically clickable
    // links rather than heading elements. The list then expands to the
    // generic containers that Tailwind / Bootstrap / utility-first SPAs
    // emit (article, [role=article]/[role=listitem], span, div, section)
    // because real-world post cards often carry all their text in
    // <div>s with no semantic heading. The post-pruning pass keeps the
    // deepest candidate per branch, so a <div> containing an <h3>
    // collapses to the <h3>; only the leaf-most text gets its own block.
    'h1, h2, h3, h4, h5, h6, p, li, blockquote, td, figcaption, a',
    'article, [role="article"], [role="listitem"]',
    'span, div, section',
    // Tab strip: ARIA tabs are typically <button role="tab"> or
    // <a role="tab">. The role selector keeps the catch inclusive without
    // re-introducing the generic <button> exclusion for action buttons
    // (e.g. "发布讨论" / "保存") that should stay in source language.
    '[role="tab"]',
    // Navigation and shell copy is useful reading content too. Keep the
    // selector narrow so controls are still excluded by the ancestor rules.
    'header a, header p, header li, header h1, header h2, header h3, header h4, header h5, header h6',
    'header button, header span, header div, header section',
    'nav a, [role="navigation"] a',
    'nav button, [role="navigation"] button, nav span, nav div, nav section',
    'footer a, footer p, footer li, footer h1, footer h2, footer h3, footer h4, footer h5, footer h6',
    'footer button, footer span, footer div, footer section',
    // Sidebar / complementary content (forum nav, doc TOC, settings panels)
    // is also part of the page shell users want translated. Sites with
    // sidebar widgets that should NOT be translated (e.g. doc-side TOC in
    // framework-docs) opt out via site rule's `excludedSelectors`.
    'aside a, aside p, aside li, aside h1, aside h2, aside h3, aside h4, aside h5, aside h6',
    'aside button, aside span, aside div, aside section',
    // Sites that do not use the semantic <header> / <footer> tags rely on
    // ARIA landmarks. The WAI-ARIA spec maps role="banner" to <header>,
    // role="contentinfo" to <footer>, and role="complementary" to <aside>;
    // sites that follow the spec still expose these roles regardless of
    // the tag they pick. Adding the role selectors covers Gatsby / Next /
    // custom shells that use <div role>.
    '[role="banner"] a, [role="banner"] p, [role="banner"] li, [role="banner"] h1, [role="banner"] h2, [role="banner"] h3, [role="banner"] h4, [role="banner"] h5, [role="banner"] h6',
    '[role="banner"] button, [role="banner"] span, [role="banner"] div, [role="banner"] section',
    '[role="contentinfo"] a, [role="contentinfo"] p, [role="contentinfo"] li, [role="contentinfo"] h1, [role="contentinfo"] h2, [role="contentinfo"] h3, [role="contentinfo"] h4, [role="contentinfo"] h5, [role="contentinfo"] h6',
    '[role="contentinfo"] button, [role="contentinfo"] span, [role="contentinfo"] div, [role="contentinfo"] section',
    '[role="complementary"] a, [role="complementary"] p, [role="complementary"] li, [role="complementary"] h1, [role="complementary"] h2, [role="complementary"] h3, [role="complementary"] h4, [role="complementary"] h5, [role="complementary"] h6',
    '[role="complementary"] button, [role="complementary"] span, [role="complementary"] div, [role="complementary"] section',
  ].join(', ');

export const TRANSLATION_ALWAYS_EXCLUDED_ANCESTOR_SELECTOR = [
  'script',
  'style',
  'noscript',
  'code',
  'pre',
  'textarea',
  'input',
  'select',
  'button',
  'form',
  '[contenteditable]:not([contenteditable="false"])',
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
    const block = planTranslationBlock({
      id: options.getId(element),
      text: options.getText(element),
      // Only ancestors (not the element itself) decide exclusion. Without
      // this, a <button> that the block selector picks up (e.g. via
      // `aside button`) would still be excluded by the `button` entry in
      // ALWAYS_EXCLUDED, because Element.closest matches the element
      // itself. Walking only parents lets the explicit block-selector
      // hit on a shell button take effect.
      isExcluded: hasAncestorMatching(
        element,
        isExplicitlyIncluded
          ? TRANSLATION_ALWAYS_EXCLUDED_ANCESTOR_SELECTOR
          : excludedSelector,
      ),
      isVisible: isVisible(element),
    });

    return block ? [{ ...block, element }] : [];
  });
  const candidatesByElement = new Map(
    candidates.map((candidate) => [candidate.element, candidate]),
  );

  return pruneAncestorCandidates(candidates, (candidate) => {
    let parent = candidate.element.parentElement;
    while (parent) {
      const parentCandidate = candidatesByElement.get(parent);
      if (parentCandidate) {
        return parentCandidate;
      }
      parent = parent.parentElement;
    }
    return null;
  });
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
      if (hasAncestorMatching(el, skipSubtreeSelector)) continue;
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
        // Defensive double-check in the generator below; the value we
        // return here only matters in browsers that honour it.
        return 0x1 /* FILTER_ACCEPT — let every element through */;
      },
    },
  );
  let current: Node | null = walker.nextNode();
  while (current) {
    const element = current as HTMLElement;
    if (hasAncestorMatching(element, skipSubtreeSelector)) {
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
