/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = resolve('.');
const secretChecks = [
  { label: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { label: 'cloud access key', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { label: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { label: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/g },
  {
    label: 'provider API key',
    pattern: /(?:^|[^A-Za-z0-9])(?:sk|dsk)-[A-Za-z0-9_-]{24,}\b/g,
  },
  {
    label: 'authorization token',
    pattern: /\bBearer[ \t]+[A-Za-z0-9._~+/=-]{24,}\b/gi,
  },
];

const personalPathPattern = /\/(?:Users|home)\/[A-Za-z0-9._-]+(?:\/|$)/g;
const remoteScriptPattern = /<script\b[^>]+\bsrc=["']https?:\/\//gi;
const dynamicCodePattern = /\beval\s*\(|\bnew\s+Function\s*\(/g;
const packageManifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const lockfile = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));

assert.equal(packageManifest.license, 'Apache-2.0', 'package.json must declare Apache-2.0');
assert.match(String(packageManifest.version), /^\d+\.\d+\.\d+$/, 'package.json version must be releaseable SemVer');
assert.equal(packageManifest.name, 'textduet', 'package name must remain textduet for release artifact naming');
assert.equal(lockfile.name, packageManifest.name, 'package-lock name must match package.json');
assert.equal(lockfile.packages?.['']?.version, packageManifest.version, 'package-lock root version must match package.json');

const licenseIssues = [];
for (const [packagePath, packageInfo] of Object.entries(lockfile.packages ?? {})) {
  if (!packagePath.startsWith('node_modules/') || !packageInfo?.version) continue;
  const license = typeof packageInfo.license === 'string' ? packageInfo.license.trim() : '';
  if (!license) {
    licenseIssues.push(`${packagePath}@${packageInfo.version}: missing license`);
    continue;
  }
  if (!isSpdxExpression(license)) {
    licenseIssues.push(`${packagePath}@${packageInfo.version}: invalid SPDX expression`);
    continue;
  }
  if (/\b(?:AGPL|GPL|LGPL|SSPL|BUSL|EUPL|OSL|CDDL)\b/i.test(license)) {
    licenseIssues.push(`${packagePath}@${packageInfo.version}: copyleft license requires an explicit review`);
  }
}
assert.equal(licenseIssues.length, 0, `Dependency license scan failed:\n${licenseIssues.join('\n')}`);

const trackedFiles = await listRepositoryFiles();
const findings = [];
for (const relativePath of trackedFiles) {
  if (shouldSkip(relativePath)) continue;
  let content;
  try {
    const data = await readFile(resolve(root, relativePath));
    if (data.includes(0)) continue;
    content = data.toString('utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') continue;
    throw error;
  }
  const codeFile = isCodeFile(relativePath);
  for (const check of secretChecks) {
    const matches = content.match(check.pattern) ?? [];
    const suspiciousMatches = matches.filter((match) => !isApprovedFixture(match));
    if (suspiciousMatches.length > 0) {
      findings.push(`${relativePath}: ${check.label}`);
    }
    check.pattern.lastIndex = 0;
  }
  if (personalPathPattern.test(content)) findings.push(`${relativePath}: personal absolute path`);
  personalPathPattern.lastIndex = 0;
  if (codeFile) {
    if (remoteScriptPattern.test(content)) findings.push(`${relativePath}: remote executable script`);
    remoteScriptPattern.lastIndex = 0;
    if (dynamicCodePattern.test(content)) findings.push(`${relativePath}: dynamic code execution`);
    dynamicCodePattern.lastIndex = 0;
  }
}

assert.equal(
  findings.length,
  0,
  `Source security scan failed (matches are reported without values):\n${[...new Set(findings)].join('\n')}`,
);

const licenseFile = await readFile(resolve(root, 'LICENSE'), 'utf8');
assert(licenseFile.includes('Apache License, Version 2.0'), 'LICENSE must contain the Apache-2.0 text');
const noticeFile = await readFile(resolve(root, 'NOTICE'), 'utf8');
assert(noticeFile.includes('Copyright 2026 frealcat'), 'NOTICE must identify frealcat');
const thirdPartyNotices = await readFile(resolve(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
assert(thirdPartyNotices.includes('THIRD_PARTY_LICENSES.json'), 'third-party notices must reference the generated report');

process.stdout.write(
  `Source and license verification passed: ${trackedFiles.length} repository files, ${Object.keys(lockfile.packages ?? {}).length} lock entries.\n`,
);

async function listRepositoryFiles() {
  const { stdout } = await execFileAsync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout.split('\0').filter(Boolean);
}

function shouldSkip(path) {
  return path === '.env.local'
    || path.startsWith('.git/')
    || path.startsWith('node_modules/')
    || path.startsWith('.output/')
    || path.startsWith('.pages/')
    || path.startsWith('coverage/')
    || path.startsWith('output/playwright/');
}

function isCodeFile(path) {
  return new Set(['.html', '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.vue', '.css']).has(extname(path).toLowerCase());
}

function isSpdxExpression(value) {
  return /^[A-Za-z0-9][A-Za-z0-9.+-]*(?:\s+(?:AND|OR|WITH)\s+[A-Za-z0-9][A-Za-z0-9.+-]*)*$/.test(value);
}

function isApprovedFixture(value) {
  // Browser regression harnesses use these exact non-secret literals. Keep the
  // exception narrow so a different credential-looking value still fails CI.
  return value === 'Bearer billing-browser-placeholder' || value === 'Bearer local-test-placeholder';
}
