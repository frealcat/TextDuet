/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDir = resolve('.output');
const packageManifest = JSON.parse(await readFile(resolve('package.json'), 'utf8'));
const archiveName = `textduet-${packageManifest.version}-chrome.zip`;
const archivePath = resolve(outputDir, archiveName);
const archiveStat = await stat(archivePath);
const archiveFiles = (await readdir(outputDir)).filter((fileName) => /^textduet-[0-9]+\.[0-9]+\.[0-9]+-chrome\.zip$/.test(fileName));
if (archiveFiles.length !== 1 || archiveFiles[0] !== archiveName) {
  throw new Error(`Expected exactly one release ZIP (${archiveName}), found: ${archiveFiles.join(', ') || 'none'}`);
}
const digest = createHash('sha256').update(await readFile(archivePath)).digest('hex');
const lines = [`${digest}  ${archiveName}`];

for (const fileName of ['SBOM.cdx.json', 'THIRD_PARTY_LICENSES.json']) {
  const path = resolve(outputDir, fileName);
  const fileStat = await stat(path);
  if (!fileStat.isFile() || fileStat.size === 0) throw new Error(`${fileName} is missing or empty`);
  lines.push(`${createHash('sha256').update(await readFile(path)).digest('hex')}  ${fileName}`);
}

await writeFile(resolve(outputDir, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`, 'utf8');
process.stdout.write(`Wrote SHA256SUMS.txt for ${archiveName} (${archiveStat.size} bytes).\n`);
