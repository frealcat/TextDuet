/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const pagesRoot = resolve('.pages');
const policySources = [
  {
    path: 'docs/PRIVACY.md',
    language: 'en',
    pattern: /^>\s*Last updated:\s*(\d{4}-\d{2}-\d{2})\s*$/m,
  },
  {
    path: 'docs/PRIVACY.zh-CN.md',
    language: 'zh-CN',
    pattern: /^>\s*更新日期：\s*(\d{4}-\d{2}-\d{2})\s*$/m,
  },
];

const policyDates = Object.fromEntries(
  await Promise.all(policySources.map(async (source) => [source.language, await readPolicyDate(source)])),
);
assert.equal(policyDates.en, policyDates['zh-CN'], 'English and Chinese policy dates must match');

const expected = [
  {
    path: 'privacy/index.html',
    language: 'en',
    title: 'TextDuet Privacy Policy',
    alternate: '../zh-CN/privacy/',
  },
  {
    path: 'zh-CN/privacy/index.html',
    language: 'zh-CN',
    title: 'TextDuet 隐私政策',
    alternate: '../../privacy/',
  },
];

const sharedFiles = ['index.html', 'assets/site.css', 'assets/icon-128.png'];
for (const relativePath of sharedFiles) await assertFile(relativePath);

const landing = await readPage('index.html');
assert.match(landing, /<html\s+lang="en">/i, 'Pages landing language must be en');
assert.match(landing, /privacy\//, 'Pages landing must link the English privacy page');
assert.match(landing, /zh-CN\/privacy\//, 'Pages landing must link the Chinese privacy page');
assertNoExecutableMarkup(landing, 'index.html');

for (const page of expected) {
  const html = await readPage(page.path);
  assert.match(html, new RegExp(`<html\\s+lang="${escapeRegExp(page.language)}">`, 'i'), `${page.path} language is incorrect`);
  assert.match(html, new RegExp(`<title>${escapeRegExp(page.title)}<\\/title>`, 'i'), `${page.path} title is incorrect`);
  assert.match(html, new RegExp(escapeRegExp(policyDates[page.language])), `${page.path} policy date is missing or stale`);
  assert.match(html, new RegExp(`href="${escapeRegExp(page.alternate)}"`), `${page.path} language switch is missing`);
  assert.match(html, /href="\.\.?(?:\/\.\.)?\/assets\/site\.css"/, `${page.path} stylesheet link is missing`);
  assert.match(html, /href="(?:\.\.\/)+assets\/icon-128\.png"/, `${page.path} icon link is missing`);
  assert.match(html, /GitHub Discussions/, `${page.path} support link is missing`);
  assertNoExecutableMarkup(html, page.path);
}

process.stdout.write(`Pages verification passed: ${expected.length} privacy pages and ${sharedFiles.length} shared assets.\n`);

async function readPage(relativePath) {
  await assertFile(relativePath);
  return readFile(resolve(pagesRoot, relativePath), 'utf8');
}

async function readPolicyDate(source) {
  const markdown = await readFile(resolve(source.path), 'utf8');
  const match = source.pattern.exec(markdown);
  assert(match, `${source.path} must declare a policy date in its expected format`);
  return match[1];
}

async function assertFile(relativePath) {
  const path = resolve(pagesRoot, relativePath);
  await access(path);
  const fileStat = await stat(path);
  assert(fileStat.isFile() && fileStat.size > 0, `${relativePath} is missing or empty`);
}

function assertNoExecutableMarkup(html, relativePath) {
  assert(!/<script\b/i.test(html), `${relativePath} must not contain script tags`);
  assert(!/\bon[a-z][a-z0-9-]*\s*=/i.test(html), `${relativePath} must not contain inline event handlers`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
