/**
 * Scheduler helpers (TD-2026-026 Layer 4).
 *
 * Wraps `scheduler.postTask` / `scheduler.yield` (Chromium 129+) with
 * a `setTimeout` / microtask fallback so the rest of the pipeline
 * works in Chrome 100-128 and in node test environments. The
 * runtime contract forbids new dependencies, so we cannot pull in
 * `scheduler-polyfill`; this file is the in-tree shim.
 *
 * The default priority is `background` because translation is a
 * low-priority side effect — never block user input, scroll, or
 * paint. Callers that need higher priority (e.g. selection
 * translation) can pass `priority: 'user-visible'` explicitly.
 */

export type TaskPriority = 'user-blocking' | 'user-visible' | 'background';

export interface PostTaskOptions {
  priority?: TaskPriority;
  signal?: AbortSignal;
  /** Optional timeout in ms. Defaults to no timeout. */
  delay?: number;
}

interface GlobalScheduler {
  postTask?: (
    callback: () => void | Promise<void>,
    options: { priority: TaskPriority; signal?: AbortSignal; delay?: number },
  ) => Promise<void>;
  yield?: () => Promise<void>;
}

function resolveScheduler(): GlobalScheduler | null {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as { scheduler?: GlobalScheduler }).scheduler ?? null;
}

export function isBackgroundTaskSchedulerAvailable(): boolean {
  return resolveScheduler()?.postTask !== undefined;
}

/**
 * Run `callback` at the next idle slot, abortable via the
 * `AbortSignal`. Returns a Promise that resolves once the callback
 * has been invoked (or skipped on abort). The callback may return
 * a Promise to chain work; the helper awaits it.
 */
export async function scheduleBackgroundTask(
  callback: () => void | Promise<void>,
  options: PostTaskOptions = {},
): Promise<void> {
  const { priority = 'background', signal, delay } = options;
  if (signal?.aborted) return;

  const scheduler = resolveScheduler();
  if (scheduler?.postTask) {
    try {
      await scheduler.postTask(callback, { priority, signal, delay });
      return;
    } catch (error) {
      // The runtime contract for scheduler.postTask rejects with
      // `AbortError` when the signal is cancelled. That is the
      // expected path and must not surface as a translation error.
      if ((error as { name?: string }).name === 'AbortError') return;
      // Any other failure (e.g. user agent disabled scheduler at
      // runtime) falls through to the setTimeout fallback so the
      // translation pipeline still completes.
    }
  }

  await runWithTimerFallback(callback, signal, delay);
}

async function runWithTimerFallback(
  callback: () => void | Promise<void>,
  signal: AbortSignal | undefined,
  delay: number | undefined,
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    let settled = false;
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      Promise.resolve(callback()).then(resolve, resolve);
    }, delay ?? 0);
    signal?.addEventListener('abort', onAbort);
  });
}

/**
 * Yield to the browser's main thread without blocking paint. Uses
 * `scheduler.yield` when available, falls back to a 0-ms timer.
 * Translation work that runs every MutationObserver tick should call
 * this between batches so a busy page does not starve the main
 * thread (which Chrome flags as a `longtask` > 50 ms).
 */
export async function yieldToMain(): Promise<void> {
  const scheduler = resolveScheduler();
  if (scheduler?.yield) {
    try {
      await scheduler.yield();
      return;
    } catch {
      // Scheduler disabled mid-run; fall through.
    }
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/**
 * Build a leading-edge throttle. The first call to the returned
 * function invokes `fn` immediately; subsequent calls within
 * `delayMs` are suppressed. This is the right shape for
 * "do not run the same heavy cleanup twice in 50 ms" use cases
 * like SPA reset (visibilitychange + popstate + hashchange +
 * viewtransitionstart can all fire inside a single tick on
 * view-transitions pages).
 */
export function createLeadingThrottle(
  delayMs: number,
  fn: () => void,
): () => void {
  let lastCallTime = 0;
  return () => {
    const now = Date.now();
    if (now - lastCallTime < delayMs) return;
    lastCallTime = now;
    fn();
  };
}
