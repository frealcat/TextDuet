/**
 * Strategy dispatcher (TD-2026-026 Layer 2).
 *
 * Picks the right `TranslationStrategy` for a given `SiteProfile`.
 * The current default is the `fallback` strategy, which delegates
 * to the proven implementation; future iterations can branch on
 * `profile.architecture` to add per-architecture tweaks.
 */

import type { SiteProfile } from './site-profile';
import { fallbackStrategy } from './strategies/fallback';
import type { TranslationStrategy } from './strategies/types';

export function selectStrategy(_profile: SiteProfile): TranslationStrategy {
  // The fallback strategy already handles every architecture the
  // existing 218 tests exercise. Architecture-specific branches
  // (ClassicSSR / SPA / StreamingSSR / SSG-ISR / PWA-SW / MPA /
  // Islands / Hybrid) will be added in subsequent iterations; for
  // now the dispatcher just returns the proven default.
  return fallbackStrategy;
}
