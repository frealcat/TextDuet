/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve('.');

describe('Translator storage boundary', () => {
  it('imports the storage-free i18n runtime instead of the aggregate i18n module', async () => {
    const source = await readFile(resolve(root, 'entrypoints/translator.ts'), 'utf8');
    expect(source).toContain("@/src/i18n/translator-runtime");
    expect(source).not.toMatch(/from\s+['"]@\/src\/i18n['"]/);
  });

  it('keeps the Translator i18n runtime free of storage dependencies', async () => {
    const source = await readFile(resolve(root, 'src/i18n/translator-runtime.ts'), 'utf8');
    expect(source).not.toMatch(/(?:browser|chrome)\.storage/i);
    expect(source).not.toMatch(/(?:storage|user-locales|translate-dictionary)/i);
  });
});
