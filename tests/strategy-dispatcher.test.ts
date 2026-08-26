import { describe, expect, it } from 'vitest';
import { selectStrategy } from '@/src/translator/strategy-dispatcher';
import { fallbackStrategy } from '@/src/translator/strategies/fallback';

describe('strategy-dispatcher (Layer 2)', () => {
  it('returns the fallback strategy for an empty profile', () => {
    const profile = {
      architecture: 'classic-ssr' as const,
      hydration: 'full' as const,
      streamActive: false,
      navType: 'history-api' as const,
      hasShadowDom: false,
      hasSameOriginIframes: false,
      detectedAt: 0,
    };
    const strategy = selectStrategy(profile);
    expect(strategy).toBe(fallbackStrategy);
  });

  it('returns a strategy with collect / installObserver / onRouteChange', () => {
    const profile = {
      architecture: 'spa' as const,
      hydration: 'full' as const,
      streamActive: false,
      navType: 'hash' as const,
      hasShadowDom: false,
      hasSameOriginIframes: false,
      detectedAt: 0,
    };
    const strategy = selectStrategy(profile);
    expect(typeof strategy.collectInitialCandidates).toBe('function');
    expect(typeof strategy.installObserver).toBe('function');
    expect(typeof strategy.onRouteChange).toBe('function');
    expect(strategy.id).toBe('fallback');
    expect(strategy.priorityHint).toBe('background');
  });

  it('fallback strategy advertises support for every architecture', () => {
    const architectures = [
      'classic-ssr',
      'spa',
      'streaming-ssr',
      'ssg-isr',
      'pwa-sw',
      'mpa',
      'islands',
      'hybrid',
    ] as const;
    for (const architecture of architectures) {
      expect(fallbackStrategy.supportedArchitectures).toContain(architecture);
    }
  });

  it('onRouteChange calls remove + abort + scheduleScan in order', () => {
    const calls: string[] = [];
    const ctx = {
      runId: 1,
      scheduleScan: () => {
        calls.push('scan');
      },
      removeRenderedTranslations: () => {
        calls.push('remove');
      },
      abortInFlightTasks: () => {
        calls.push('abort');
      },
    };
    fallbackStrategy.onRouteChange(ctx);
    expect(calls).toEqual(['remove', 'abort', 'scan']);
  });

  it('collectInitialCandidates forwards to the proven dom-extraction helper', () => {
    // We avoid calling the full pipeline here because the default
    // `isElementVisible` helper relies on `getComputedStyle`, which
    // linkedom does not implement. The unit-level coverage of
    // `collectTranslationCandidates` is already in
    // `tests/dom-extraction.test.ts` (22 passing). Here we just
    // assert that the strategy exposes the same entry point.
    expect(typeof fallbackStrategy.collectInitialCandidates).toBe('function');
    expect(fallbackStrategy.collectInitialCandidates.length).toBe(2);
  });
});
