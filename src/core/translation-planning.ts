import type { TranslationBlock } from './contracts';

export const MIN_TRANSLATION_CHARACTERS = 2;
export const MAX_TRANSLATION_CHARACTERS = 4_000;
export const DEFAULT_BATCH_CHARACTER_LIMIT = 4_000;

export interface TranslationCandidateSnapshot {
  id: string;
  text: string;
  isExcluded: boolean;
  isVisible: boolean;
}

/** Normalizes webpage text without interpreting it as markup or instructions. */
export function normalizeTranslationText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Converts an untrusted DOM snapshot into the minimal block sent to the Provider. */
export function planTranslationBlock(
  snapshot: TranslationCandidateSnapshot,
): TranslationBlock | null {
  if (snapshot.isExcluded || !snapshot.isVisible) {
    return null;
  }

  const text = normalizeTranslationText(snapshot.text);
  if (text.length < MIN_TRANSLATION_CHARACTERS || text.length > MAX_TRANSLATION_CHARACTERS) {
    return null;
  }

  return { id: snapshot.id, text };
}

/**
 * Removes container candidates when a more specific descendant is already present.
 * This prevents list items and table cells from duplicating nested paragraph text.
 */
export function pruneAncestorCandidates<T>(
  candidates: readonly T[],
  getParentCandidate: (candidate: T) => T | null,
): T[] {
  const ancestors = new Set<T>();

  for (const candidate of candidates) {
    let ancestor = getParentCandidate(candidate);
    while (ancestor && !ancestors.has(ancestor)) {
      ancestors.add(ancestor);
      ancestor = getParentCandidate(ancestor);
    }
  }

  return candidates.filter((candidate) => !ancestors.has(candidate));
}

/** Creates ordered batches while guaranteeing that every batch stays within its character limit. */
export function createTranslationBatches(
  blocks: readonly TranslationBlock[],
  characterLimit = DEFAULT_BATCH_CHARACTER_LIMIT,
): TranslationBlock[][] {
  if (!Number.isInteger(characterLimit) || characterLimit < MAX_TRANSLATION_CHARACTERS) {
    throw new Error(`批次字符上限不能小于 ${MAX_TRANSLATION_CHARACTERS}`);
  }

  const batches: TranslationBlock[][] = [];
  let currentBatch: TranslationBlock[] = [];
  let currentCharacters = 0;

  for (const block of blocks) {
    if (currentBatch.length > 0 && currentCharacters + block.text.length > characterLimit) {
      batches.push(currentBatch);
      currentBatch = [];
      currentCharacters = 0;
    }

    currentBatch.push(block);
    currentCharacters += block.text.length;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}
