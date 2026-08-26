/**
 * Fallback strategy (TD-2026-026 Layer 2).
 *
 * The default strategy. Delegates to the proven implementation in
 * `dom-extraction` / `dynamic-content` so all 218 existing tests
 * keep passing unchanged. Future iterations can add architecture-
 * specific strategies (ClassicSSR / SPA / StreamingSSR / SSG-ISR /
 * PWA-SW / MPA / Islands / Hybrid) that override one or more of
 * these methods while sharing the rest.
 */

import {
  collectTranslationCandidates,
  type TranslationDomCandidate,
} from '../dom-extraction';
import {
  observeDynamicContent,
  type DynamicContentHandle,
} from '../dynamic-content';
import type {
  CollectOptions,
  RunContext,
  TranslationStrategy,
} from './types';

export const fallbackStrategy: TranslationStrategy = {
  id: 'fallback',
  supportedArchitectures: [
    'classic-ssr',
    'spa',
    'streaming-ssr',
    'ssg-isr',
    'pwa-sw',
    'mpa',
    'islands',
    'hybrid',
  ],
  collectInitialCandidates(
    doc: Document,
    options: CollectOptions,
  ): TranslationDomCandidate[] {
    return collectTranslationCandidates(doc, options);
  },
  installObserver(
    onContentChanged: () => void,
    _context: RunContext,
  ): DynamicContentHandle {
    // The strategy dispatcher does not own the source-text cache; the
    // existing `observeDynamicContent` call site in translator.ts
    // passes its own `sourceTextByElement` WeakMap. We therefore
    // accept the slight wart of re-reading the global cache here.
    return observeDynamicContent(readSourceTextCache(), onContentChanged);
  },
  onRouteChange(context: RunContext): void {
    context.removeRenderedTranslations();
    context.abortInFlightTasks();
    context.scheduleScan();
  },
  priorityHint: 'background',
};

/**
 * The runtime contract lets every `observeDynamicContent` caller pass
 * its own WeakMap. Strategies are stateless, so they cannot own
 * one directly; the fallback reads the global registry that
 * `entrypoints/translator.ts` populates. This keeps the contract
 * without requiring a full Strategy refactor of the run lifecycle.
 */
function readSourceTextCache(): WeakMap<HTMLElement, string> {
  const candidate = (globalThis as { textduetSourceTextCache?: WeakMap<HTMLElement, string> })
    .textduetSourceTextCache;
  if (candidate) return candidate;
  return new WeakMap<HTMLElement, string>();
}
