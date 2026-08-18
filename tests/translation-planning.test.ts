import { describe, expect, it } from 'vitest';
import {
  createTranslationBatches,
  normalizeTranslationText,
  planTranslationBlock,
  pruneAncestorCandidates,
} from '@/src/core/translation-planning';

describe('translation planning', () => {
  it('normalizes whitespace and accepts visible reading text', () => {
    expect(normalizeTranslationText('  A\n\n bilingual\tpage  ')).toBe('A bilingual page');
    expect(
      planTranslationBlock({
        id: 'block-1',
        text: '  A\n\n bilingual\tpage  ',
        isExcluded: false,
        isVisible: true,
      }),
    ).toEqual({ id: 'block-1', text: 'A bilingual page' });
  });

  it('rejects excluded, hidden, too-short and oversized blocks', () => {
    const base = { id: 'block-1', text: 'Readable text', isExcluded: false, isVisible: true };

    expect(planTranslationBlock({ ...base, isExcluded: true })).toBeNull();
    expect(planTranslationBlock({ ...base, isVisible: false })).toBeNull();
    expect(planTranslationBlock({ ...base, text: 'A' })).toBeNull();
    expect(planTranslationBlock({ ...base, text: 'x'.repeat(4_001) })).toBeNull();
  });

  it('keeps the most specific nested candidates', () => {
    const candidates = [
      { name: 'list', parent: null },
      { name: 'list-item', parent: 'list' },
      { name: 'paragraph', parent: 'list-item' },
      { name: 'sibling', parent: null },
    ];
    const candidatesByName = new Map(candidates.map((candidate) => [candidate.name, candidate]));

    expect(
      pruneAncestorCandidates(candidates, (candidate) =>
        candidate.parent ? candidatesByName.get(candidate.parent) || null : null,
      ).map((candidate) => candidate.name),
    ).toEqual(['paragraph', 'sibling']);
  });

  it('prunes 2000 nested candidates with a bounded number of parent lookups', () => {
    const candidates = Array.from({ length: 2_000 }, (_, index) => ({ index }));
    let parentLookups = 0;

    const result = pruneAncestorCandidates(candidates, (candidate) => {
      parentLookups += 1;
      return candidate.index > 0 ? candidates[candidate.index - 1] ?? null : null;
    });

    expect(result).toEqual([candidates.at(-1)]);
    expect(parentLookups).toBeLessThanOrEqual(4_000);
  });

  it('creates ordered batches without crossing the character limit', () => {
    const blocks = [
      { id: '1', text: 'a'.repeat(3_000) },
      { id: '2', text: 'b'.repeat(2_500) },
      { id: '3', text: 'c'.repeat(1_000) },
    ];

    expect(createTranslationBatches(blocks).map((batch) => batch.map(({ id }) => id))).toEqual([
      ['1'],
      ['2', '3'],
    ]);
  });

  it('rejects a batch limit smaller than the maximum valid block', () => {
    expect(() => createTranslationBatches([], 3_999)).toThrow('批次字符上限不能小于 4000');
  });
});
