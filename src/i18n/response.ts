/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  I18N_RESULT_KEY_MAX_LENGTH,
  I18N_RESULT_MAX_KEYS,
  I18N_RESULT_TOTAL_CHARS,
  I18N_RESULT_VALUE_MAX_LENGTH,
} from '@/src/core/schemas';

/**
 * Parses a Provider's JSON dictionary and keeps only the requested keys.
 * Provider output is untrusted: cap the result before it reaches UI state or
 * storage, and use a null-prototype map so special keys cannot mutate Object.
 */
export function extractI18nTranslations(
  raw: string,
  expectedKeys: readonly string[],
): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Some models wrap JSON in ``` fences. Strip and retry.
    const fenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    parsed = JSON.parse(fenced);
  }
  if (!parsed || typeof parsed !== 'object') return {};
  const obj = parsed as Record<string, unknown>;
  const out: Record<string, string> = Object.create(null) as Record<string, string>;
  let totalChars = 0;
  for (const key of expectedKeys.slice(0, I18N_RESULT_MAX_KEYS)) {
    if (
      key.length === 0
      || key.length > I18N_RESULT_KEY_MAX_LENGTH
      || key === '__proto__'
      || key === 'constructor'
      || key === 'prototype'
    ) continue;
    const value = obj[key];
    if (typeof value !== 'string' || value.length === 0 || value.length > I18N_RESULT_VALUE_MAX_LENGTH) continue;
    const entryChars = key.length + value.length;
    if (totalChars + entryChars > I18N_RESULT_TOTAL_CHARS) break;
    out[key] = value;
    totalChars += entryChars;
  }
  return out;
}
