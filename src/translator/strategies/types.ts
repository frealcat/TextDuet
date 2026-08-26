/**
 * Translation strategy types (TD-2026-026 Layer 2).
 *
 * A `TranslationStrategy` encapsulates the architecture-specific tweaks
 * needed to translate a page reliably: how to find candidate blocks,
 * how to observe dynamic content, when to reset on a route change,
 * and what priority to use for the background work.
 *
 * Three primary strategies and five fallback strategies are defined
 * in this directory; the dispatcher (`strategy-dispatcher.ts`)
 * picks the right one based on a `SiteProfile`. The current default
 * `fallback` strategy delegates to the existing implementation in
 * `dom-extraction` / `dynamic-content` so behavior is unchanged for
 * all 218 already-passing tests.
 */

import type { SiteArchitecture } from '../site-profile';
import type { TranslationDomCandidate } from '../dom-extraction';
import type { DynamicContentHandle } from '../dynamic-content';
import type { SiteRule } from '../site-rules';

export interface CollectOptions {
  getId: (element: HTMLElement) => string;
  getText: (element: HTMLElement) => string;
  isVisible?: (element: HTMLElement) => boolean;
  siteRule?: SiteRule | null;
}

export type SchedulerPriority = 'user-blocking' | 'user-visible' | 'background';

export interface RunContext {
  /** The active run id; used by observers to ignore stale callbacks. */
  readonly runId: number;
  /** Inject the strategy's preferred background-priority scheduler. */
  readonly scheduleScan: () => void;
  /** Force a full cleanup of all inserted translations. */
  readonly removeRenderedTranslations: () => void;
  /** Cancel any in-flight `scheduler.postTask` callback. */
  readonly abortInFlightTasks: () => void;
}

export interface TranslationStrategy {
  readonly id: string;
  readonly supportedArchitectures: readonly SiteArchitecture[];
  /**
   * Collect the initial set of candidates when the user first
   * triggers translation. Pure function; no DOM mutation.
   */
  collectInitialCandidates(doc: Document, options: CollectOptions): TranslationDomCandidate[];
  /**
   * Install a long-lived observer for dynamic content. Must return
   * a handle the run can call `disconnect()` and `abort()` on.
   */
  installObserver(
    onContentChanged: () => void,
    context: RunContext,
  ): DynamicContentHandle;
  /**
   * Called when the user navigates inside a SPA. Implementations
   * may wipe their cached state, reset observers, and re-scan.
   */
  onRouteChange(context: RunContext): void;
  /**
   * Hint passed to `scheduler.postTask` when scheduling background
   * work. `background` is the safe default; `user-visible` is
   * reserved for selection translation and the like.
   */
  readonly priorityHint: SchedulerPriority;
}
