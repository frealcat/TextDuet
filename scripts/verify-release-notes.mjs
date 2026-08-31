/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const packageManifest = JSON.parse(await readFile(resolve('package.json'), 'utf8'));
const version = process.argv[2] ?? packageManifest.version;
assert.match(version, /^\d+\.\d+\.\d+$/, `Invalid release version: ${version}`);

const notes = [
  {
    path: `docs/RELEASE-NOTES-${version}.md`,
    title: `# TextDuet ${version} Release Notes`,
    draftMarkers: [
      /(^|\n)>\s*\*\*Draft\s*\/\s*unpublished\.?\*\*/i,
      /intentionally a draft until/i,
      /not claims of completion in this draft/i,
    ],
  },
  {
    path: `docs/RELEASE-NOTES-${version}.zh-CN.md`,
    title: `# TextDuet ${version} 发布说明`,
    draftMarkers: [
      /(^|\n)>\s*\*\*草案\s*\/\s*尚未发布[。.]?\*\*/,
      /有意保持为草案/,
      /不是本草案对完成情况的声明/,
    ],
  },
];

for (const note of notes) {
  const content = await readFile(resolve(note.path), 'utf8');
  assert(content.trim().length > 0, `${note.path} is empty`);
  assert(content.startsWith(`${note.title}\n`), `${note.path} has an unexpected title`);
  const marker = note.draftMarkers.find((pattern) => pattern.test(content));
  assert(!marker, `${note.path} is still marked as a draft; finalize it before tagging ${version}`);
}

process.stdout.write(`Release notes verification passed for ${version}: ${notes.length} bilingual files are publication-ready.\n`);
