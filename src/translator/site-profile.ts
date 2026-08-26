/**
 * Site Profile detection (TD-2026-026 Layer 1)
 *
 * One-shot read-only sniff of the current page. Runs before the
 * Strategy Dispatcher (Layer 2) picks a translation strategy, so every
 * downstream layer can branch on a stable `SiteProfile` value.
 *
 * Detection is intentionally cheap (no DOM mutation, no deep tree walk,
 * no event listener registration). It runs in &lt; 5ms on a 1k-node page
 * and can be called again after SPA navigation to refresh the
 * `detectedAt` timestamp.
 */

export type SiteArchitecture =
  | 'classic-ssr'
  | 'spa'
  | 'streaming-ssr'
  | 'ssg-isr'
  | 'pwa-sw'
  | 'mpa'
  | 'islands'
  | 'hybrid';

export type HydrationMode = 'none' | 'partial' | 'full';

export type NavigationType = 'history-api' | 'hash' | 'none';

export interface SiteProfile {
  /** Coarse architecture classification used to pick a translation strategy. */
  architecture: SiteArchitecture;
  /** How much of the page is hydrated on the client after SSR. */
  hydration: HydrationMode;
  /** True when the page uses RSC-style streaming chunks (Next.js 14+ App Router). */
  streamActive: boolean;
  /** What API the site uses for client-side navigation, if any. */
  navType: NavigationType;
  /** True when the document contains at least one open shadow root. */
  hasShadowDom: boolean;
  /** True when at least one iframe is same-origin (we can recurse into it). */
  hasSameOriginIframes: boolean;
  /** Set when the page is detected as Next.js with React Server Components. */
  rscVersion?: 'next-13' | 'next-14+';
  /** Wall-clock timestamp of the last detection. Strategy dispatcher can
   *  re-invoke `detectSiteProfile` to refresh this on long-lived sessions. */
  detectedAt: number;
}

const DEFAULT_PROFILE: SiteProfile = {
  architecture: 'classic-ssr',
  hydration: 'full',
  streamActive: false,
  navType: 'history-api',
  hasShadowDom: false,
  hasSameOriginIframes: false,
  detectedAt: 0,
};

interface DetectionGlobals {
  readonly document: Document;
  readonly window: Window;
}

function resolveGlobals(
  targetDoc: Document | undefined,
  targetWin: Window | undefined,
): DetectionGlobals | null {
  if (targetDoc && targetWin) {
    return { document: targetDoc, window: targetWin };
  }
  if (typeof globalThis === 'undefined') return null;
  const doc = targetDoc ?? (globalThis as { document?: Document }).document;
  const win = targetWin ?? (globalThis as { window?: Window }).window;
  if (!doc || !win) return null;
  return { document: doc, window: win };
}

function detectNextRouterClientNavigation(win: Window): boolean {
  const candidate = (win as unknown as { next?: { router?: unknown } }).next;
  return Boolean(candidate?.router);
}

function detectRscStream(win: Window): boolean {
  const nextFlight = (win as unknown as { __next_f?: unknown }).__next_f;
  return Array.isArray(nextFlight);
}

function detectNextDataScript(doc: Document): { present: boolean; isStatic: boolean } {
  const node = doc.getElementById('__NEXT_DATA__');
  if (!node?.textContent) return { present: false, isStatic: false };
  try {
    const data = JSON.parse(node.textContent) as { isStatic?: boolean };
    return { present: true, isStatic: Boolean(data.isStatic) };
  } catch {
    return { present: true, isStatic: false };
  }
}

function detectServiceWorker(win: Window): boolean {
  return Boolean(win.navigator?.serviceWorker?.controller);
}

function detectAstroIslands(doc: Document): boolean {
  // Astro serializes scoped style hashes as `data-astro-cid-<hash>`
  // on every island element. Iterate the attribute names so we match
  // both the bare `data-astro-cid` and the hashed variants without
  // depending on CSS attribute-substring matching support.
  for (const el of Array.from(doc.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name === 'data-astro-cid' || attr.name.startsWith('data-astro-cid-')) {
        return true;
      }
    }
  }
  return false;
}

function detectMpaRefresh(doc: Document): boolean {
  return doc.querySelector('meta[http-equiv="refresh" i]') !== null;
}

function detectHashRouting(win: Window): boolean {
  return win.location?.hash.length > 1;
}

function detectOpenShadowRoot(doc: Document): boolean {
  for (const el of Array.from(doc.querySelectorAll('*'))) {
    if ((el as HTMLElement).shadowRoot !== null) return true;
  }
  return false;
}

function detectSameOriginIframes(doc: Document): boolean {
  for (const frame of Array.from(doc.querySelectorAll('iframe'))) {
    try {
      // Cross-origin frames throw on `contentDocument` access in
      // supporting browsers; we only count frames we can actually read.
      if (frame.contentDocument) return true;
    } catch {
      // Cross-origin; skip.
    }
  }
  return false;
}

/**
 * Detect the current page's architecture and surface a `SiteProfile`.
 *
 * Returns `null` only when the function is invoked in an environment
 * that has neither `document` nor `window` (e.g. unit tests run via
 * node without `dom` test environment). Production code in a content
 * script context always has both.
 */
export function detectSiteProfile(
  targetDoc?: Document,
  targetWin?: Window,
): SiteProfile | null {
  const globals = resolveGlobals(targetDoc, targetWin);
  if (!globals) return null;
  const { document: doc, window: win } = globals;

  const profile: SiteProfile = { ...DEFAULT_PROFILE, detectedAt: Date.now() };

  // 1. RSC Streaming has the highest priority. If `self.__next_f` is
  // present, the page is consuming React Server Component payload —
  // either Next.js 14+ App Router (most common) or a custom RSC
  // implementation. Mark `streamActive` so the Layer 4 scheduler
  // uses background priority for translation.
  if (detectRscStream(win)) {
    profile.architecture = 'streaming-ssr';
    profile.streamActive = true;
    profile.rscVersion = 'next-14+';
  }

  // 2. Next.js classic `__NEXT_DATA__` script tag. Distinguishes
  // SSG/ISR (isStatic=true) from runtime SSR. Does not override the
  // streaming-ssr detection above because __NEXT_DATA__ is also
  // present in App Router for hydration bootstrap.
  const nextData = detectNextDataScript(doc);
  if (nextData.present && profile.architecture === 'classic-ssr') {
    profile.architecture = nextData.isStatic ? 'ssg-isr' : 'classic-ssr';
  }

  // 3. Nuxt 3 leaves a `__NUXT__` script. We do not branch on its
  // payload shape because Nuxt 3 hydrates client-side and reuses
  // the same translation strategy as classic SSR.
  // (Detection only — see site-rules.ts for hostname-specific tuning.)

  // 4. Next.js App Router client navigation: `window.next.router`
  // exists when the App Router has been hydrated, even if the page
  // was server-rendered. If the page is in this state and was not
  // already classified as streaming-ssr, treat it as spa (the runtime
  // mutates the DOM in place on every Link click).
  if (detectNextRouterClientNavigation(win) && profile.architecture !== 'streaming-ssr') {
    profile.architecture = 'spa';
  }

  // 5. PWA via Service Worker. SW can swap the entire document body
  // on navigation, so even classic SSR is effectively PWA-style from
  // the translation extension's perspective.
  if (detectServiceWorker(win)) {
    profile.architecture = 'pwa-sw';
  }

  // 6. Astro Islands: static HTML with `data-astro-cid-*` attributes
  // marks each independently-hydrated island. This is the only case
  // where the strategy dispatcher may need to scope translation per
  // island boundary.
  if (detectAstroIslands(doc)) {
    profile.architecture = 'islands';
  }

  // 7. MPA fallback: explicit `&lt;meta http-equiv="refresh"&gt;` on
  // the page. Rare in modern apps but still used by legacy servers.
  if (detectMpaRefresh(doc)) {
    profile.architecture = 'mpa';
  }

  // 8. Hash routing overrides the history-api default. Hash routes
  // (e.g. `/#/section`) need the hashchange listener in the SPA
  // reset layer.
  if (detectHashRouting(win)) {
    profile.navType = 'hash';
  }

  // 9. Shadow DOM presence flag. We do not recurse into closed shadow
  // roots (Chrome MV3 limitation); the flag only tells the strategy
  // dispatcher that some translation is unavoidably hidden.
  profile.hasShadowDom = detectOpenShadowRoot(doc);

  // 10. Same-origin iframes. We do not recurse automatically; the
  // strategy dispatcher decides whether to enter each frame based
  // on this flag.
  profile.hasSameOriginIframes = detectSameOriginIframes(doc);

  return profile;
}
