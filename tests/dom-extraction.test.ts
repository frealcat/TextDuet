import { describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';
import {
  TRANSLATION_BLOCK_SELECTOR,
  TRANSLATION_SEMANTIC_READING_SELECTOR,
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

  it('keeps shell controls excluded while retaining nearby reading copy and links', () => {
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

  it('never treats TextDuet-owned page and selection spans as new source content', () => {
    const document = makeDocument(`
      <main>
        <h1>Readable page title</h1>
        <span class="textduet-source">Readable page title</span>
        <span class="textduet-translation">Titre de page lisible</span>
        <span class="textduet-selection-translation">Traduction de sélection</span>
        <span class="textduet-selection-error">TextDuet：error</span>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, {
      getId: GET_ID,
      getText: GET_TEXT,
      isVisible: ALWAYS_VISIBLE,
    });
    expect(candidates.map(({ text }) => text)).toEqual(['Readable page title']);
  });
});

describe('dom-extraction aside / complementary', () => {
  it('exposes aside and [role="complementary"] in the default block selector', () => {
    expect(TRANSLATION_BLOCK_SELECTOR).toContain('aside a');
    expect(TRANSLATION_BLOCK_SELECTOR).toContain('aside p');
    expect(TRANSLATION_BLOCK_SELECTOR).toContain('aside li');
    expect(TRANSLATION_BLOCK_SELECTOR).toContain('[role="complementary"] a');
  });

  it('collects sidebar nav links and items inside <aside>', () => {
    const document = makeDocument(`
      <main>
        <aside>
          <nav>
            <a href="/a">All Topics</a>
            <a href="/b">Favorites</a>
          </nav>
          <ul>
            <li>Section one</li>
            <li>Section two</li>
          </ul>
          <p>Sidebar intro</p>
        </aside>
        <article><p>Body</p></article>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    expect(texts).toContain('All Topics');
    expect(texts).toContain('Favorites');
    expect(texts).toContain('Section one');
    expect(texts).toContain('Section two');
    expect(texts).toContain('Sidebar intro');
  });

  it('collects [role="complementary"] descendants', () => {
    const document = makeDocument(`
      <main>
        <div role="complementary">
          <a href="/a">Complementary link</a>
          <p>Complementary paragraph</p>
        </div>
        <article><p>Body</p></article>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    expect(texts).toContain('Complementary link');
    expect(texts).toContain('Complementary paragraph');
  });

  it('keeps aside buttons excluded while retaining sidebar links', () => {
    const document = makeDocument(`
      <main>
        <aside>
          <a href="/a">Sidebar link</a>
          <button>Login</button>
        </aside>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    expect(texts).toContain('Sidebar link');
    expect(texts).not.toContain('Login');
  });

  it('site rule can still opt out of aside (e.g. framework-docs TOC)', () => {
    const document = makeDocument(`
      <main>
        <aside>
          <a href="/a">Doc TOC item</a>
        </aside>
        <article><p>Body</p></article>
      </main>
    `);
    const rule: SiteRule = {
      id: 'framework-docs',
      hostnames: ['react.dev'],
      rootSelectors: ['main', 'article'],
      excludedSelectors: ['aside', '.sidebar', '.toc'],
    };
    const candidates = collectTranslationCandidates(document as never, {
      getId: GET_ID,
      getText: GET_TEXT,
      isVisible: ALWAYS_VISIBLE,
      siteRule: rule,
    });
    const texts = candidates.map((c) => c.text);
    expect(texts).not.toContain('Doc TOC item');
    expect(texts).toContain('Body');
  });
});

describe('dom-extraction article / listitem', () => {
  it('exposes article and ARIA list-item in the default block selector', () => {
    expect(TRANSLATION_BLOCK_SELECTOR).toContain('article');
    expect(TRANSLATION_BLOCK_SELECTOR).toContain('[role="article"]');
    expect(TRANSLATION_BLOCK_SELECTOR).toContain('[role="listitem"]');
    expect(TRANSLATION_SEMANTIC_READING_SELECTOR).toContain('[role="listitem"]');
  });

  it('collects <span> badges / tags / inline labels as standalone blocks', () => {
    const document = makeDocument(`
      <main>
        <div>
          <h3>Weekly project update</h3>
          <span>Announcement</span>
          <p>The team completed the accessibility review.</p>
        </div>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    expect(texts).toContain('Weekly project update');
    expect(texts).toContain('Announcement');
    expect(texts).toContain('The team completed the accessibility review.');
  });

  it('collects [role="listitem"] for ARIA-based feed cards', () => {
    const document = makeDocument(`
      <main>
        <ul role="feed">
          <li role="listitem">
            <h3>Post one</h3>
            <p>Snippet one</p>
          </li>
          <li role="listitem">
            <h3>Post two</h3>
            <p>Snippet two</p>
          </li>
        </ul>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    expect(texts).toContain('Post one');
    expect(texts).toContain('Snippet one');
    expect(texts).toContain('Post two');
    expect(texts).toContain('Snippet two');
  });

  it('does not collect empty <span> (icon containers, SVG wrappers)', () => {
    const document = makeDocument(`
      <main>
        <article>
          <h3>Title</h3>
          <span><svg viewBox="0 0 24 24"></svg></span>
          <span>Visible badge</span>
        </article>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    expect(texts).toContain('Visible badge');
    // The svg-only span has no textContent so it is filtered by getText
    expect(texts).not.toContain('');
  });
});

describe('dom-extraction SPA shell coverage', () => {
  it('collects <div> post cards and prunes descendants to the deepest block', () => {
    const document = makeDocument(`
      <main>
        <div>
          <span>交流互助</span>
          <h3>Weekly project update</h3>
          <p>The team shipped the release candidate on time.</p>
        </div>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    // Pruning keeps the deepest block per branch (h3 + p + span are kept;
    // the wrapping div is removed because it has candidate descendants).
    expect(texts).toContain('Weekly project update');
    expect(texts).toContain('The team shipped the release candidate on time.');
    expect(texts).toContain('交流互助');
  });

  it('does not collect sidebar navigation buttons', () => {
    const document = makeDocument(`
      <aside>
        <nav>
          <button type="button">全部话题</button>
          <button type="button">收藏</button>
        </nav>
      </aside>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    expect(texts).not.toContain('全部话题');
    expect(texts).not.toContain('收藏');
  });

  it('does not collect ARIA tab controls', () => {
    const document = makeDocument(`
      <main>
        <div>
          <button role="tab" type="button">最新发布</button>
          <button role="tab" type="button">最新回复</button>
        </div>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    expect(texts).not.toContain('最新发布');
    expect(texts).not.toContain('最新回复');
  });

  it('does not translate a generic container whose only text is an action control', () => {
    const document = makeDocument(`
      <main>
        <div>
          <button type="button">发布讨论</button>
        </div>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    expect(texts).not.toContain('发布讨论');
  });

  it('retains semantic reading text next to an excluded action control', () => {
    const document = makeDocument(`
      <main>
        <div>
          <p>Discussion summary</p>
          <button type="button">发布讨论</button>
        </div>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    expect(texts).toContain('Discussion summary');
    expect(texts).not.toContain('发布讨论');
  });

  it('still collects a bare non-interactive SPA reading container', () => {
    const document = makeDocument(`
      <main><div>Utility-first reading copy without semantic markup.</div></main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    expect(candidates.map((c) => c.text)).toContain('Utility-first reading copy without semantic markup.');
  });

  it('excludes non-button ARIA controls and their wrapper text', () => {
    const document = makeDocument(`
      <main>
        <div role="switch">Enable translations</div>
        <div><span role="menuitem">Settings</span></div>
        <p>Readable summary</p>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    expect(texts).not.toContain('Enable translations');
    expect(texts).not.toContain('Settings');
    expect(texts).toContain('Readable summary');
  });

  it('excludes role-button links and contenteditable controls without excluding ordinary links', () => {
    const document = makeDocument(`
      <main>
        <nav>
          <a href="/read">Read documentation</a>
          <a href="/open" role="button">Open panel</a>
        </nav>
        <div contenteditable="true">Draft title</div>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    expect(texts).toContain('Read documentation');
    expect(texts).not.toContain('Open panel');
    expect(texts).not.toContain('Draft title');
  });

  it('excludes generic wrappers around native summary controls', () => {
    const document = makeDocument(`
      <main>
        <div><summary>Show details</summary></div>
        <p>Static details summary</p>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    expect(texts).not.toContain('Show details');
    expect(texts).toContain('Static details summary');
  });

  it('excludes a generic wrapper around an ARIA search control', () => {
    const document = makeDocument(`
      <main>
        <div><div role="search">Search products</div></div>
        <p>Product catalogue</p>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    expect(texts).not.toContain('Search products');
    expect(texts).toContain('Product catalogue');
  });

  it('does not aggregate hidden descendant text into a generic container', () => {
    const document = makeDocument(`
      <main>
        <div><span aria-hidden="true">Private hint</span></div>
        <p>Public reading copy</p>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    const texts = candidates.map((c) => c.text);
    expect(texts).not.toContain('Private hint');
    expect(texts).toContain('Public reading copy');
  });

  it('prefers excluding a mixed bare container to translating its control label', () => {
    const document = makeDocument(`
      <main><div>Article summary <button type="button">Read more</button></div></main>
    `);
    const candidates = collectTranslationCandidates(document as never, { getId: GET_ID, getText: GET_TEXT, isVisible: ALWAYS_VISIBLE });
    // There is no semantic child that can carry only the reading text. The
    // conservative contract keeps both strings out rather than sending the
    // action label to the model as part of a container aggregate.
    expect(candidates.map((c) => c.text)).not.toContain('Article summary Read more');
  });

  it('keeps semantic prose when an inline native control is present', () => {
    const document = makeDocument(`
      <main>
        <article data-test="article">Article body <button type="button">Read more</button></article>
        <div role="listitem" data-test="listitem">Card summary <button type="button">Open card</button></div>
        <p data-test="paragraph">Paragraph copy <button type="button">Share</button></p>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, {
      getId: GET_ID,
      // Deliberately use raw textContent: the extractor itself must enforce
      // the no-control-text boundary for custom callers as well.
      getText: GET_TEXT,
      isVisible: ALWAYS_VISIBLE,
    });
    const texts = candidates.map((candidate) => candidate.text);

    expect(texts).toContain('Article body');
    expect(texts).toContain('Card summary');
    expect(texts).toContain('Paragraph copy');
    expect(texts).not.toContain('Article body Read more');
    expect(texts).not.toContain('Card summary Open card');
    expect(texts).not.toContain('Paragraph copy Share');
    expect(texts).not.toContain('Read more');
    expect(texts).not.toContain('Open card');
    expect(texts).not.toContain('Share');
  });

  it('keeps direct prose around inline formatting instead of pruning the semantic parent', () => {
    const document = makeDocument(`
      <main>
        <p data-test="formatted">Lead sentence <span>inline phrase</span> trailing text <button type="button">Action</button></p>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, {
      getId: GET_ID,
      getText: GET_TEXT,
      isVisible: ALWAYS_VISIBLE,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.element.tagName).toBe('P');
    expect(candidates[0]?.text).toBe('Lead sentence inline phrase trailing text');
  });

  it('strips hidden and inert descendants from semantic reading text', () => {
    const document = makeDocument(`
      <main>
        <p data-test="visible">Visible paragraph <span hidden>Private hint</span><span inert>Deferred hint</span></p>
      </main>
    `);
    const candidates = collectTranslationCandidates(document as never, {
      getId: GET_ID,
      getText: GET_TEXT,
      isVisible: ALWAYS_VISIBLE,
    });
    const texts = candidates.map((candidate) => candidate.text);

    expect(texts).toContain('Visible paragraph');
    expect(texts).not.toContain('Visible paragraph Private hint Deferred hint');
    expect(texts).not.toContain('Private hint');
    expect(texts).not.toContain('Deferred hint');
  });
});
