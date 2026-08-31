/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Returns whether asynchronous work still belongs to the active page view.
 *
 * A run can remain active while a SPA swaps its view. Comparing only the run
 * id is therefore insufficient: a response from the previous view could be
 * committed into the newly mounted DOM. Keeping this predicate pure makes the
 * stale-result boundary directly testable without importing the WXT entrypoint.
 */
export function isCurrentView(
  activeRunId: number,
  runId: number,
  activeViewGeneration: number,
  requestViewGeneration: number,
): boolean {
  return activeRunId === runId && activeViewGeneration === requestViewGeneration;
}

/**
 * Starts a new SPA view while discarding terminal bookkeeping from the
 * previous view. Element ids intentionally survive DOM reuse, so keeping a
 * failed or translated id here would either suppress a new route forever or
 * report stale progress. In-flight work is rejected separately by
 * `isCurrentView`.
 */
export function advanceViewGeneration(
  currentGeneration: number,
  failedIds: Set<string>,
  translatedIds: Set<string>,
): number {
  failedIds.clear();
  translatedIds.clear();
  return currentGeneration + 1;
}
