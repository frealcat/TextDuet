import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const fixtureUrl = new URL('./fixtures/pages/', import.meta.url);

function readFixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(name, fixtureUrl)), 'utf8');
}

describe('website acceptance corpus', () => {
  it.each([
    'article-basic.html',
    'technical-docs.html',
    'discussion-dynamic.html',
    'dynamic-virtualized.html',
    'mixed-ui.html',
    'multilingual.html',
  ])('contains a complete HTML document: %s', (name) => {
    const document = readFixture(name);
    expect(document).toContain('<!doctype html>');
    expect(document).toContain('<main>');
    expect(document).toContain('</html>');
  });

  it('contains explicit exclusion cases', () => {
    const technicalDocs = readFixture('technical-docs.html');
    const mixedUi = readFixture('mixed-ui.html');
    const articleBasic = readFixture('article-basic.html');
    const chromaResearch = readFixture('chroma-research-toc.html');

    expect(technicalDocs).toContain('<pre data-td-expect="exclude"><code');
    expect(mixedUi).toContain('contenteditable="true"');
    expect(mixedUi).toContain('<textarea data-td-expect="exclude">');
    expect(mixedUi).toContain('class="breadcrumbs"');
    expect(mixedUi).toContain('aria-hidden="true"');
    expect(articleBasic).toContain('<a href="/" data-td-expect="include">Home</a>');
    expect(articleBasic).toContain('<button type="button" data-td-expect="exclude">Sign in</button>');
    expect(articleBasic).toContain('<footer><p data-td-expect="include">Privacy · Terms · Contact</p></footer>');
    expect(chromaResearch).toContain('<a href="/" data-td-expect="include">Product</a>');
    expect(technicalDocs).toContain('<a href="#create" data-td-expect="include">Create a widget</a>');
    expect(mixedUi).toContain('<a href="/inbox" data-td-expect="include">Inbox</a>');
  });

  it('contains virtual-list node reuse and document-root replacement controls', () => {
    const dynamicVirtualized = readFixture('dynamic-virtualized.html');

    expect(dynamicVirtualized).toContain('data-virtual-row="reused"');
    expect(dynamicVirtualized).toContain('data-version="initial"');
    expect(dynamicVirtualized).toContain('data-version="replaced-body"');
  });
});
