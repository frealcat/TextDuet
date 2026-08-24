import type { TranslationBlock } from '@/src/core/contracts';
import {
  planTranslationBlock,
  pruneAncestorCandidates,
} from '@/src/core/translation-planning';
import { getRuleRootElements, type SiteRule } from './site-rules';

export const TRANSLATION_BLOCK_SELECTOR =
  [
    'h1, h2, h3, h4, h5, h6, p, li, blockquote, td, figcaption',
    // Navigation and shell copy is useful reading content too. Keep the
    // selector narrow so controls are still excluded by the ancestor rules.
    'header a, header p, header li, header h1, header h2, header h3, header h4, header h5, header h6',
    'nav a, [role="navigation"] a',
    'footer a, footer p, footer li, footer h1, footer h2, footer h3, footer h4, footer h5, footer h6',
    // Sites that do not use the semantic <header> / <footer> tags rely on
    // ARIA landmarks. The WAI-ARIA spec maps role="banner" to <header> and
    // role="contentinfo" to <footer>; sites that follow the spec still
    // expose these roles regardless of the tag they pick. Adding the role
    // selectors covers Gatsby / Next / custom shells that use <div role>.
    '[role="banner"] a, [role="banner"] p, [role="banner"] li, [role="banner"] h1, [role="banner"] h2, [role="banner"] h3, [role="banner"] h4, [role="banner"] h5, [role="banner"] h6',
    '[role="contentinfo"] a, [role="contentinfo"] p, [role="contentinfo"] li, [role="contentinfo"] h1, [role="contentinfo"] h2, [role="contentinfo"] h3, [role="contentinfo"] h4, [role="contentinfo"] h5, [role="contentinfo"] h6',
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
  '[role="complementary"]',
  'aside',
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
  const elements = [
    ...new Set(
    [
      ...getRuleRootElements(document, options.siteRule ?? null),
      document.documentElement,
    ].flatMap((root) => [
        ...(root.matches(blockSelector) ? [root] : []),
        ...root.querySelectorAll<HTMLElement>(blockSelector),
      ]),
    ),
  ];
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
      isExcluded: Boolean(element.closest(
        isExplicitlyIncluded
          ? TRANSLATION_ALWAYS_EXCLUDED_ANCESTOR_SELECTOR
          : excludedSelector,
      )),
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
