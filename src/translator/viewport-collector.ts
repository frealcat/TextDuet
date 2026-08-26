/**
 * Viewport-aware translation collector (TD-2026-026 Layer 3).
 *
 * For long articles and SPA pages with virtual scrolling, translating
 * every block eagerly wastes API quota and inflates INP. Instead we
 * translate only what the user is about to see, then keep an
 * `IntersectionObserver` open to catch elements scrolling into the
 * `200px` rootMargin pre-buffer.
 *
 * The collector is plain JavaScript and operates on an `Element[]`
 * collected upstream (typically by `walkTextCandidates`). The caller
 * is responsible for:
 *   1. Producing the candidate set (selector-based, no visibility check).
 *   2. Wiring `onEnter` / `onLeave` callbacks that trigger
 *      translation work without blocking.
 *
 * If `IntersectionObserver` is unavailable (older browsers, some
 * test environments) the collector falls back to a synchronous pass
 * that fires `onEnter` for every element immediately and returns
 * `null` for the disconnect handle. This keeps the Layer 3 / Layer 4
 * pipeline working in degraded environments.
 */

export interface ViewportCollectorHandlers {
  /** Fired the first time an element enters the visible area. */
  onEnter: (element: HTMLElement) => void;
  /** Fired when an element leaves the visible area. */
  onLeave?: (element: HTMLElement) => void;
}

export interface ViewportCollectorHandle {
  /** Stop observing all elements. Idempotent. */
  disconnect: () => void;
  /** Number of elements currently observed. */
  observedCount: number;
}

const DEFAULT_ROOT_MARGIN = '200px 0px';
const DEFAULT_THRESHOLD = 0;

export function installViewportCollector(
  elements: readonly HTMLElement[],
  handlers: ViewportCollectorHandlers,
  rootMargin: string = DEFAULT_ROOT_MARGIN,
  threshold: number | readonly number[] = DEFAULT_THRESHOLD,
): ViewportCollectorHandle | null {
  const doc = elements[0]?.ownerDocument ?? globalThis.document;
  if (!doc || typeof (doc as Document).defaultView === 'undefined') return null;
  const win = (doc as Document).defaultView as Window & {
    IntersectionObserver?: typeof IntersectionObserver;
  };
  if (typeof win.IntersectionObserver !== 'function') {
    // No IO support — fall back to a one-shot sync pass so the rest
    // of the pipeline still translates the page, just eagerly.
    for (const element of elements) handlers.onEnter(element);
    return { disconnect: () => undefined, observedCount: 0 };
  }

  const observed = new Set<HTMLElement>();
  const observer = new win.IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        if (entry.isIntersecting) {
          if (observed.has(target)) continue;
          observed.add(target);
          handlers.onEnter(target);
        } else {
          if (!observed.has(target)) continue;
          observed.delete(target);
          handlers.onLeave?.(target);
        }
      }
    },
    { rootMargin, threshold: threshold as number | number[] },
  );

  for (const element of elements) {
    observer.observe(element);
  }

  return {
    disconnect: () => {
      observer.disconnect();
      observed.clear();
    },
    get observedCount(): number {
      return observed.size;
    },
  };
}
