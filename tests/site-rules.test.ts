import { describe, expect, it } from 'vitest';
import {
  resolveSiteRule,
  type SiteRule,
} from '@/src/translator/site-rules';

describe('site rules', () => {
  it('matches exact hosts and subdomains without matching lookalikes', () => {
    expect(resolveSiteRule({ hostname: 'github.com', pathname: '/org/repo' })?.id).toBe('github');
    expect(resolveSiteRule({ hostname: 'www.github.com', pathname: '/org/repo' })?.id).toBe('github');
    expect(resolveSiteRule({ hostname: 'gist.github.com', pathname: '/abc' })?.id).toBe('github');
    expect(resolveSiteRule({ hostname: 'notgithub.com', pathname: '/' })).toBeNull();
  });

  it('matches documented framework and content categories', () => {
    expect(resolveSiteRule({ hostname: 'react.dev', pathname: '/learn' })?.id).toBe('framework-docs');
    expect(resolveSiteRule({ hostname: 'dev.to', pathname: '/' })?.id).toBe('overseas-community');
    expect(resolveSiteRule({ hostname: 'typewolf.com', pathname: '/' })?.id).toBe('creative-design');
    expect(resolveSiteRule({
      hostname: 'www.trychroma.com',
      pathname: '/research/context-rot',
    })?.id).toBe('chroma-research');
    expect(resolveSiteRule({ hostname: 'trychroma.com', pathname: '/pricing' })).toBeNull();
    expect(resolveSiteRule({ hostname: 'example.com', pathname: '/' })).toBeNull();
  });

  it('limits Chroma directory links to its article root', () => {
    const rule = resolveSiteRule({
      hostname: 'trychroma.com',
      pathname: '/research/context-rot',
    });
    expect(rule?.includedSelectors).toContain('.markdown-content nav');
    expect(rule?.blockSelectors).toContain('.markdown-content nav a');
  });

  it('honors path prefixes when a rule declares them', () => {
    const rules: readonly SiteRule[] = [{
      id: 'docs-only',
      hostnames: ['example.com'],
      pathPrefixes: ['/docs'],
      rootSelectors: ['main'],
      excludedSelectors: [],
    }];
    expect(resolveSiteRule({ hostname: 'example.com', pathname: '/docs/start' }, rules)?.id).toBe('docs-only');
    expect(resolveSiteRule({ hostname: 'example.com', pathname: '/blog' }, rules)).toBeNull();
  });
});
