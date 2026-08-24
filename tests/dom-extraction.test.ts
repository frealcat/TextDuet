import { describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';
import {
  TRANSLATION_BLOCK_SELECTOR,
  collectTranslationCandidates,
} from '@/src/translator/dom-extraction';
import type { SiteRule } from '@/src/translator/site-rules';

const { document: globalDocument } = parseHTML('<!doctype html><html></html>');

function makeDocument(html: string): Document {
  return parseHTML(html).document as unknown as Document;
}

const GET_ID = (element: HTMLElement) =>
  (element as unknown as { getAttribute(name: string): string | null }).getAttribute('data-test')
  || element.textContent?.trim()
  || '';
const GET_TEXT = (element: HTMLElement) => element.textContent?.trim() || '';
const ALWAYS_VISIBLE = () => true;

describe('dom-extraction header / footer selectors', () => {
  it('exposes ARIA landmark selectors in the default block selector', () => {
    expect(TRANSLATION_BLOCK_SELECTOR).toContain('[role="banner"]');
    expect(TRANSLATION_BLOCK_SELECTOR).toContain('[role="contentinfo"]');
  });

  it('collects descendants of <header> and <footer> semantic tags', () => {
    const document = makeDocument(`
      <main>
        <header><p>Site title</p><a href="/a">Link A</a></header>
        <article><p>Body paragraph</p></article>
        <footer><p>Footer text</p></footer>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    expect(texts).toContain('Site title');
    expect(texts).toContain('Link A');
    expect(texts).toContain('Body paragraph');
    expect(texts).toContain('Footer text');
  });

  it('collects descendants of [role="banner"] and [role="contentinfo"]', () => {
    const document = makeDocument(`
      <main>
        <div role="banner"><p>ARIA header</p><a href="/a">ARIA nav</a></div>
        <article><p>Body</p></article>
        <div role="contentinfo"><p>ARIA footer</p></div>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    expect(texts).toContain('ARIA header');
    expect(texts).toContain('ARIA nav');
    expect(texts).toContain('ARIA footer');
  });

  it('collects nested children inside ARIA landmark wrappers', () => {
    const document = makeDocument(`
      <main>
        <div role="banner">
          <div class="bar"><div class="inner"><p>Nested ARIA header</p></div></div>
        </div>
        <article><p>Body</p></article>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    expect(texts).toContain('Nested ARIA header');
  });

  it('does not regress when no header / footer / banner is present', () => {
    const document = makeDocument(`
      <main>
        <article><h1>Title</h1><p>Body</p></article>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    expect(texts).toEqual(['Title', 'Body']);
  });

  it('honours site-rule headerExtras / footerExtras to expand the selector', () => {
    const document = makeDocument(`
      <main>
        <div class="site-header"><p>Custom header</p><a href="/x">Custom link</a></div>
        <article><p>Body</p></article>
        <div class="site-footer"><p>Custom footer</p></div>
      </main>
    `);
    const rule: SiteRule = {
      id: 'test',
      hostnames: ['example.com'],
      rootSelectors: ['main'],
      excludedSelectors: [],
      headerExtras: ['.site-header'],
      footerExtras: ['.site-footer'],
    };
    const candidates = collectTranslationCandidates(document as never, {
      getId: GET_ID,
      getText: GET_TEXT,
      isVisible: ALWAYS_VISIBLE,
      siteRule: rule,
    });
    const texts = candidates.map((c) => c.text);
    expect(texts).toContain('Custom header');
    expect(texts).toContain('Custom link');
    expect(texts).toContain('Custom footer');
  });

  it('silently drops invalid or empty headerExtras / footerExtras strings', () => {
    const document = makeDocument(`
      <main>
        <article><p>Body</p></article>
      </main>
    `);
    const rule: SiteRule = {
      id: 'test',
      hostnames: ['example.com'],
      rootSelectors: ['main'],
      excludedSelectors: [],
      headerExtras: ['', '   ', '   .valid-but-nothing-to-match'],
    };
    expect(() =>
      collectTranslationCandidates(document as never, {
        getId: GET_ID,
        getText: GET_TEXT,
        isVisible: ALWAYS_VISIBLE,
        siteRule: rule,
      }),
    ).not.toThrow();
  });

  it('keeps excluding controls inside header / footer landmarks', () => {
    const document = makeDocument(`
      <main>
        <header>
          <p>Header copy</p>
          <button>Submit</button>
          <input type="text" placeholder="Search" />
          <a href="/a">A link</a>
        </header>
        <article><p>Body</p></article>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    expect(texts).toContain('Header copy');
    expect(texts).toContain('A link');
    expect(texts).not.toContain('Submit');
    expect(texts).not.toContain('Search');
  });

  it('does not throw when document is the default empty document', () => {
    expect(() =>
      collectTranslationCandidates(globalDocument as unknown as Document, {
        getId: GET_ID,
        getText: GET_TEXT,
      }),
    ).not.toThrow();
  });
});
