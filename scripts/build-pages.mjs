/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const outputDirectory = resolve('.pages');
const assetDirectory = resolve('pages/assets');
const repositoryUrl = 'https://github.com/frealcat/TextDuet';

const pages = [
  {
    source: 'docs/PRIVACY.md',
    output: 'privacy/index.html',
    language: 'en',
    title: 'TextDuet Privacy Policy',
    eyebrow: 'Privacy and data handling',
    summary: 'What TextDuet processes, where it stays, and when it is sent to a provider you choose.',
    languageLabel: '中文',
    languageHref: '../zh-CN/privacy/',
    currentLabel: 'Privacy',
    privacyHref: './',
    asideTitle: 'Need help?',
    asideBody: 'For setup and provider questions, use GitHub Discussions. Do not post keys, passwords, private URLs, or sensitive page text.',
    supportLabel: 'GitHub Discussions',
    supportHref: `${repositoryUrl}/discussions`,
    footer: 'TextDuet is local-first and uses your chosen model provider only after your action.',
    assetPrefix: '..',
    skipLabel: 'Skip to content',
    homeLabel: 'Home',
    privacyLabel: 'Privacy',
    asideLabel: 'Support information',
    brandLabel: 'TextDuet home',
    navigationLabel: 'Site navigation',
  },
  {
    source: 'docs/PRIVACY.zh-CN.md',
    output: 'zh-CN/privacy/index.html',
    language: 'zh-CN',
    title: 'TextDuet 隐私政策',
    eyebrow: '隐私与数据处理',
    summary: '说明 TextDuet 处理哪些数据、数据保留在何处，以及何时会发送给你选择的服务商。',
    languageLabel: 'English',
    languageHref: '../../privacy/',
    currentLabel: '隐私政策',
    privacyHref: './',
    asideTitle: '需要帮助？',
    asideBody: '安装、Provider 或费用问题请使用 GitHub Discussions。请勿公开提交 Key、密码、私密 URL 或敏感网页文本。',
    supportLabel: 'GitHub Discussions',
    supportHref: `${repositoryUrl}/discussions`,
    footer: 'TextDuet 本地优先，只会在你主动操作后使用你选择的模型服务商。',
    assetPrefix: '../..',
    skipLabel: '跳到正文',
    homeLabel: '首页',
    privacyLabel: '隐私政策',
    asideLabel: '支持信息',
    brandLabel: 'TextDuet 首页',
    navigationLabel: '站点导航',
  },
];

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(resolve(outputDirectory, 'assets'), { recursive: true });
await copyFile(resolve(assetDirectory, 'site.css'), resolve(outputDirectory, 'assets/site.css'));
await copyFile(resolve('public/icons/icon-128.png'), resolve(outputDirectory, 'assets/icon-128.png'));
await writeFile(resolve(outputDirectory, '.nojekyll'), '');

for (const page of pages) {
  const markdown = await readFile(resolve(page.source), 'utf8');
  const html = renderPolicyPage(page, markdown);
  const outputPath = resolve(outputDirectory, page.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html);
}

await writeFile(resolve(outputDirectory, 'index.html'), renderLandingPage());

for (const page of pages) {
  const output = await readFile(resolve(outputDirectory, page.output), 'utf8');
  if (!output.includes('<article class="policy-content">') || !output.includes(page.title)) {
    throw new Error(`Generated privacy page is incomplete: ${page.output}`);
  }
}

process.stdout.write(`Built ${pages.length} public privacy pages in .pages\n`);

function renderPolicyPage(page, markdown) {
  const body = renderMarkdown(removeDocumentTitleAndLanguageLink(markdown));
  const assetHref = `${page.assetPrefix}/assets`;
  const homeHref = `${page.assetPrefix}/`;

  return documentHtml({
    language: page.language,
    title: page.title,
    assetHref,
    content: `
      <main class="page-shell" id="main-content">
        <header class="policy-hero">
          <p class="eyebrow">${escapeHtml(page.eyebrow)}</p>
          <h1>${escapeHtml(page.title)}</h1>
          <p class="hero-summary">${escapeHtml(page.summary)}</p>
          <div class="hero-links">
            <a href="${escapeAttribute(page.languageHref)}" lang="${page.language === 'en' ? 'zh-CN' : 'en'}">${escapeHtml(page.languageLabel)}</a>
            <a href="${escapeAttribute(repositoryUrl)}">GitHub</a>
          </div>
        </header>
        <div class="policy-grid">
          <article class="policy-content">${body}</article>
          <aside class="policy-aside" aria-label="${escapeAttribute(page.asideLabel)}">
            <strong>${escapeHtml(page.asideTitle)}</strong>
            <p>${escapeHtml(page.asideBody)}</p>
            <p><a href="${escapeAttribute(page.supportHref)}">${escapeHtml(page.supportLabel)}</a></p>
          </aside>
        </div>
      </main>`,
    homeHref,
    languageHref: page.languageHref,
    languageLabel: page.languageLabel,
    currentLabel: page.currentLabel,
    footer: page.footer,
    privacyHref: page.privacyHref,
    skipLabel: page.skipLabel,
    homeLabel: page.homeLabel,
    privacyLabel: page.privacyLabel,
    asideLabel: page.asideLabel,
    brandLabel: page.brandLabel,
    navigationLabel: page.navigationLabel,
  });
}

function renderLandingPage() {
  return documentHtml({
    language: 'en',
    title: 'TextDuet',
    assetHref: 'assets',
    content: `
      <main class="page-shell landing" id="main-content">
        <section class="landing-copy" aria-labelledby="landing-title">
          <p class="eyebrow">TextDuet</p>
          <h1 id="landing-title">Your key. Two languages. One page.</h1>
          <p>TextDuet is a local-first Chrome extension for reading webpages in two languages with a model provider you choose.</p>
          <div class="language-links" aria-label="Privacy policy language">
            <a href="privacy/">
              <strong>Privacy Policy</strong>
              <span>English privacy and data-handling details.</span>
            </a>
            <a href="zh-CN/privacy/" lang="zh-CN">
              <strong>隐私政策</strong>
              <span>简体中文的隐私与数据处理说明。</span>
            </a>
          </div>
        </section>
      </main>`,
    homeHref: './',
    languageHref: 'zh-CN/privacy/',
    languageLabel: '中文',
    currentLabel: 'Home',
    footer: 'TextDuet is an open-source project by frealcat.',
    privacyHref: 'privacy/',
    skipLabel: 'Skip to content',
    homeLabel: 'Home',
    privacyLabel: 'Privacy',
    asideLabel: 'Support information',
    brandLabel: 'TextDuet home',
    navigationLabel: 'Site navigation',
  });
}

function documentHtml({ language, title, assetHref, content, homeHref, languageHref, languageLabel, currentLabel, footer, privacyHref, skipLabel, homeLabel, privacyLabel, brandLabel, navigationLabel }) {
  return `<!doctype html>
<html lang="${escapeAttribute(language)}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeAttribute(title)}">
    <title>${escapeHtml(title)}</title>
    <link rel="icon" href="${escapeAttribute(assetHref)}/icon-128.png" type="image/png">
    <link rel="stylesheet" href="${escapeAttribute(assetHref)}/site.css">
  </head>
  <body>
    <a class="skip-link" href="#main-content">${escapeHtml(skipLabel)}</a>
    <header class="site-header">
      <a class="brand" href="${escapeAttribute(homeHref)}" aria-label="${escapeAttribute(brandLabel)}">
        <img class="brand-mark" src="${escapeAttribute(assetHref)}/icon-128.png" alt="" width="32" height="32">
        <span>TextDuet</span>
      </a>
      <nav class="site-nav" aria-label="${escapeAttribute(navigationLabel)}">
        <a${currentLabel === 'Home' ? ' aria-current="page"' : ''} href="${escapeAttribute(homeHref)}">${escapeHtml(homeLabel)}</a>
        <a${currentLabel === 'Privacy' || currentLabel === '隐私政策' ? ' aria-current="page"' : ''} href="${escapeAttribute(privacyHref)}">${escapeHtml(privacyLabel)}</a>
        <a href="${escapeAttribute(languageHref)}" lang="${language === 'en' ? 'zh-CN' : 'en'}">${escapeHtml(languageLabel)}</a>
        <a href="${escapeAttribute(repositoryUrl)}">GitHub</a>
      </nav>
    </header>${content}
    <footer class="site-footer">
      <span>${escapeHtml(footer)}</span>
      <a href="${escapeAttribute(repositoryUrl)}/discussions">GitHub Discussions</a>
    </footer>
  </body>
</html>
`;
}

function removeDocumentTitleAndLanguageLink(markdown) {
  return markdown
    .replace(/^# .+\r?\n+\r?\n\[[^\]]+\]\([^\n]+\)\r?\n+\r?\n/, '')
    .trim();
}

function renderMarkdown(markdown) {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const chunks = [];
  let index = 0;
  let headingCount = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    if (heading) {
      headingCount += 1;
      const level = heading[1].length;
      const text = heading[2].trim();
      chunks.push(`<h${level} id="section-${headingCount}">${renderInline(text)}</h${level}>`);
      index += 1;
      continue;
    }

    if (line.startsWith('>')) {
      const quoteLines = [];
      while (index < lines.length && lines[index].startsWith('>')) {
        quoteLines.push(lines[index].replace(/^>\s?/, '').trim());
        index += 1;
      }
      chunks.push(`<blockquote><p>${renderInline(quoteLines.join(' '))}</p></blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        const item = [lines[index].replace(/^[-*]\s+/, '').trim()];
        index += 1;
        while (index < lines.length && /^\s{2,}\S/.test(lines[index])) {
          item.push(lines[index].trim());
          index += 1;
        }
        items.push(`<li>${renderInline(item.join(' '))}</li>`);
      }
      chunks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    const paragraph = [];
    while (index < lines.length) {
      const candidate = lines[index];
      if (!candidate.trim() || /^(#{2,3})\s+/.test(candidate) || candidate.startsWith('>') || /^[-*]\s+/.test(candidate)) {
        break;
      }
      paragraph.push(candidate.trim());
      index += 1;
    }
    if (paragraph.length > 0) {
      chunks.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    } else {
      index += 1;
    }
  }

  return chunks.join('\n');
}

function renderInline(value) {
  let output = escapeHtml(value);
  output = output.replace(/\[([^\]]+)]\(([^)\s]+)\)/g, (_match, label, href) => {
    return `<a href="${safeHref(href)}">${label}</a>`;
  });
  output = output.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (_match, href) => `<a href="${safeHref(href)}">${href}</a>`);
  output = output.replace(/`([^`]+)`/g, '<code>$1</code>');
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return output;
}

function safeHref(value) {
  const href = value.replaceAll('&amp;', '&');
  if (/^(https?:\/\/|mailto:|\.\.?\/|#)/.test(href)) {
    return escapeAttribute(href);
  }
  return '#';
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
