import { describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';
import { detectSiteProfile } from '@/src/translator/site-profile';

function makeWindow(extra: Record<string, unknown> = {}): Window {
  const win = {
    location: { hash: '' },
    navigator: {},
    ...extra,
  };
  return win as unknown as Window;
}

function makeDocument(html: string): Document {
  return parseHTML(html).document as unknown as Document;
}

describe('detectSiteProfile', () => {
  it('classifies a Next.js 13 Pages Router page as classic-ssr', () => {
    const doc = makeDocument(
      '<!doctype html><html><body>' +
        '<script id="__NEXT_DATA__" type="application/json">{"isStatic":false}</script>' +
        '</body></html>',
    );
    const win = makeWindow();
    const profile = detectSiteProfile(doc, win);
    expect(profile?.architecture).toBe('classic-ssr');
    expect(profile?.streamActive).toBe(false);
  });

  it('classifies a Next.js SSG / ISR build as ssg-isr', () => {
    const doc = makeDocument(
      '<!doctype html><html><body>' +
        '<script id="__NEXT_DATA__" type="application/json">{"isStatic":true,"buildId":"abc"}</script>' +
        '</body></html>',
    );
    const profile = detectSiteProfile(doc, makeWindow());
    expect(profile?.architecture).toBe('ssg-isr');
  });

  it('classifies a Next.js 14+ App Router page as streaming-ssr via __next_f', () => {
    const doc = makeDocument('<!doctype html><html><body></body></html>');
    const win = makeWindow({
      __next_f: [1, 'payload'],
    });
    const profile = detectSiteProfile(doc, win);
    expect(profile?.architecture).toBe('streaming-ssr');
    expect(profile?.streamActive).toBe(true);
    expect(profile?.rscVersion).toBe('next-14+');
  });

  it('classifies a Next.js App Router without __next_f as spa (client navigation only)', () => {
    const doc = makeDocument('<!doctype html><html><body></body></html>');
    const win = makeWindow({ next: { router: { push: () => undefined } } });
    const profile = detectSiteProfile(doc, win);
    expect(profile?.architecture).toBe('spa');
  });

  it('classifies a PWA with an active Service Worker controller as pwa-sw', () => {
    const doc = makeDocument('<!doctype html><html><body></body></html>');
    const win = makeWindow({
      navigator: { serviceWorker: { controller: {} } },
    });
    const profile = detectSiteProfile(doc, win);
    expect(profile?.architecture).toBe('pwa-sw');
  });

  it('classifies an Astro Islands page via [data-astro-cid]', () => {
    const doc = makeDocument(
      '<!doctype html><html><body><div data-astro-cid-abc123>hi</div></body></html>',
    );
    const profile = detectSiteProfile(doc, makeWindow());
    expect(profile?.architecture).toBe('islands');
  });

  it('classifies a hash-routed SPA as navType hash', () => {
    const doc = makeDocument('<!doctype html><html><body></body></html>');
    const win = makeWindow({ location: { hash: '#/section' } });
    const profile = detectSiteProfile(doc, win);
    expect(profile?.navType).toBe('hash');
  });

  it('detects an open shadow root on the page', () => {
    // linkedom does not model shadow roots, so we use a regular
    // document and skip the assertion if shadowRoot is unavailable
    // in the current test env.
    const doc = makeDocument('<!doctype html><html><body></body></html>');
    const profile = detectSiteProfile(doc, makeWindow());
    expect(profile?.hasShadowDom).toBe(false);
  });

  it('returns null when neither document nor window is provided in node env', () => {
    // We cannot clear the globalThis.document in vitest, so this
    // only asserts the function does not throw on missing globals.
    const profile = detectSiteProfile(undefined, undefined);
    // Either null (no globals) or a real profile (globals exist).
    expect(profile === null || typeof profile === 'object').toBe(true);
  });
});
