import { describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';
import { collectTranslationCandidates } from '@/src/translator/dom-extraction';
import { TRANSLATION_BLOCK_SELECTOR } from '@/src/translator/dom-extraction';
import { SOURCE_CLASS, TRANSLATION_CLASS } from '@/src/translator/page-status';

function makeDocument(html: string): Document {
  return parseHTML('<main>' + html + '</main>').document as unknown as Document;
}

const GET_ID = (element: HTMLElement): string =>
  (element as unknown as { getAttribute(name: string): string | null }).getAttribute('data-test')
  || element.textContent?.trim()
  || '';
const GET_TEXT = (element: HTMLElement): string => element.textContent?.trim() || '';

describe('Reddit content fix — link text travels with parent paragraph', () => {
  it('top-level block selector no longer matches body <a> elements', () => {
    expect(TRANSLATION_BLOCK_SELECTOR).not.toMatch(/(?:^|,)\s*a\s*(?:,|$)/);
  });

  it('collects the parent <p> with the link text inlined, not the bare <a>', () => {
    const doc = makeDocument(
      '<p>Do not share <a href="/x">sexual</a> content.</p>',
    );
    const candidates = collectTranslationCandidates(doc, { getId: GET_ID, getText: GET_TEXT, isVisible: () => true });
    const texts = candidates.map((c) => c.text);
    expect(texts).toContain('Do not share sexual content.');
    expect(texts).not.toContain('sexual');
  });

  it('still collects header <a> so the top nav translates as one-word blocks', () => {
    const doc = makeDocument(
      '<header><nav><ul><li><a href="/c">Company</a></li></ul></nav></header>',
    );
    const candidates = collectTranslationCandidates(doc, { getId: GET_ID, getText: GET_TEXT, isVisible: () => true });
    const texts = candidates.map((c) => c.text);
    expect(texts).toContain('Company');
  });
});

describe('Reddit Rules 3/4/5 — the actual site structure the user reported', () => {
  it('translates the full paragraph as a single block including the link text', () => {
    const doc = makeDocument(
      '<h5>Rule 3</h5>' +
        '<p>Respect the privacy of others. Instigating harassment, for example by revealing someone’s <a href="/p">personal or confidential information</a>, is not allowed. Never post or threaten to post <a href="/m">intimate or sexually-explicit media</a> of someone without their consent.</p>' +
        '<h5>Rule 4</h5>' +
        '<p>Do not share or encourage the sharing of <a href="/s">sexual</a>, <a href="/a">abusive</a>, or suggestive content involving minors. Any predatory or inappropriate behavior involving a minor is also strictly prohibited.</p>',
    );
    const candidates = collectTranslationCandidates(doc, { getId: GET_ID, getText: GET_TEXT, isVisible: () => true });
    const rule3 = candidates.find((c) => c.text?.startsWith('Respect the privacy'));
    const rule4 = candidates.find((c) => c.text?.startsWith('Do not share'));
    expect(rule3).toBeDefined();
    expect(rule4).toBeDefined();
    expect(rule3?.text).toContain('personal or confidential information');
    expect(rule3?.text).toContain('intimate or sexually-explicit media');
    expect(rule4?.text).toContain('sexual');
    expect(rule4?.text).toContain('abusive');
  });
});
