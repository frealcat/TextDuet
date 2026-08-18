export interface SiteRule {
  id: string;
  hostnames: readonly string[];
  pathPrefixes?: readonly string[];
  rootSelectors: readonly string[];
  excludedSelectors: readonly string[];
  includedSelectors?: readonly string[];
  blockSelectors?: readonly string[];
}

/**
 * Conservative rules for known page shells. Rules narrow extraction only when
 * a matching root exists; the generic extractor remains the fallback.
 */
export const SITE_RULES: readonly SiteRule[] = [
  {
    id: 'github',
    hostnames: ['github.com'],
    rootSelectors: ['main', '[data-testid="readme-content"]'],
    excludedSelectors: ['header', '[data-testid="repository-container-header"]'],
  },
  {
    id: 'framework-docs',
    hostnames: [
      'react.dev',
      'vuejs.org',
      'svelte.dev',
      'vite.dev',
      'docs.astro.build',
    ],
    rootSelectors: ['main', 'article', '.VPDoc'],
    excludedSelectors: ['header', 'nav', 'aside', '.sidebar', '.toc'],
  },
  {
    id: 'overseas-community',
    hostnames: ['dev.to', 'lobste.rs'],
    rootSelectors: ['main', '#content', '#inside'],
    excludedSelectors: ['header', 'nav', 'aside'],
  },
  {
    id: 'chroma-research',
    hostnames: ['trychroma.com'],
    pathPrefixes: ['/research/'],
    rootSelectors: ['.markdown-content', 'article'],
    excludedSelectors: ['header'],
    includedSelectors: ['.markdown-content nav'],
    blockSelectors: ['.markdown-content nav a'],
  },
  {
    id: 'creative-design',
    hostnames: ['smashingmagazine.com', 'typewolf.com', 'onepagelove.com'],
    rootSelectors: ['main'],
    excludedSelectors: ['header', 'nav', 'aside', '[role="navigation"]'],
  },
];

export interface SiteLocation {
  hostname: string;
  pathname: string;
}

export function resolveSiteRule(
  location: SiteLocation,
  rules: readonly SiteRule[] = SITE_RULES,
): SiteRule | null {
  const hostname = location.hostname.toLowerCase().replace(/^www\./, '');
  return rules.find((rule) => {
    const hostnameMatches = rule.hostnames.some((host) => {
      const normalizedHost = host.toLowerCase().replace(/^www\./, '');
      return hostname === normalizedHost || hostname.endsWith(`.${normalizedHost}`);
    });
    if (!hostnameMatches) return false;
    return rule.pathPrefixes?.some((prefix) => location.pathname.startsWith(prefix)) ?? true;
  }) || null;
}

export function getRuleRootElements(
  document: Document,
  rule: SiteRule | null,
): HTMLElement[] {
  if (!rule) return [document.documentElement];

  const roots = rule.rootSelectors.flatMap((selector) => {
    try {
      return Array.from(document.querySelectorAll<HTMLElement>(selector));
    } catch {
      return [];
    }
  });
  const uniqueRoots = [...new Set(roots)];
  return uniqueRoots.length > 0 ? uniqueRoots : [document.documentElement];
}
