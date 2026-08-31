/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { advanceViewGeneration, isCurrentView } from '@/src/translator/view-generation';

describe('SPA view-generation stale-result boundary', () => {
  it('accepts work from the active run and same view generation', () => {
    expect(isCurrentView(7, 7, 3, 3)).toBe(true);
  });

  it('rejects a late response after the SPA replaces the view', () => {
    // The run id is intentionally unchanged: navigation increments only the
    // generation, so a run-id-only guard would incorrectly commit old DOM.
    expect(isCurrentView(7, 7, 4, 3)).toBe(false);
  });

  it('rejects work from a stopped or superseded run', () => {
    expect(isCurrentView(8, 7, 3, 3)).toBe(false);
    expect(isCurrentView(7, 6, 3, 3)).toBe(false);
  });

  it('starts a fresh bookkeeping domain when a reused SPA view advances', () => {
    const failedIds = new Set(['reused-node']);
    const translatedIds = new Set(['old-node']);

    expect(advanceViewGeneration(3, failedIds, translatedIds)).toBe(4);
    expect(failedIds.size).toBe(0);
    expect(translatedIds.size).toBe(0);
  });
});
