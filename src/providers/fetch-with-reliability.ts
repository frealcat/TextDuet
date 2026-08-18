export interface FetchReliabilityOptions {
  timeoutMs: number;
  maxAttempts: number;
  retryBaseDelayMs: number;
  signal?: AbortSignal;
}

/** Runs a Provider request with per-attempt timeout, bounded retries and caller cancellation. */
export async function fetchWithReliability(
  url: string,
  init: RequestInit,
  options: FetchReliabilityOptions,
): Promise<Response> {
  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    throwIfStopped(options.signal);

    const attemptController = new AbortController();
    let didTimeout = false;
    const stopAttempt = () => attemptController.abort();
    options.signal?.addEventListener('abort', stopAttempt, { once: true });
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      attemptController.abort();
    }, options.timeoutMs);

    try {
      const response = await fetch(url, { ...init, signal: attemptController.signal });
      if (isRetryableStatus(response.status) && attempt < options.maxAttempts) {
        await waitForRetry(retryDelay(attempt, options.retryBaseDelayMs), options.signal);
        continue;
      }
      return response;
    } catch (error) {
      if (options.signal?.aborted) {
        throw new Error('已停止翻译');
      }
      if (attempt < options.maxAttempts) {
        await waitForRetry(retryDelay(attempt, options.retryBaseDelayMs), options.signal);
        continue;
      }
      if (didTimeout) {
        throw new Error('模型请求超时，请检查网络后重试');
      }
      if (isAbortError(error)) {
        throw new Error('模型请求已取消');
      }
      throw new Error('多次重试后仍无法连接模型服务，请检查网络');
    } finally {
      clearTimeout(timeoutId);
      options.signal?.removeEventListener('abort', stopAttempt);
    }
  }

  throw new Error('模型请求失败');
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function retryDelay(attempt: number, baseDelayMs: number): number {
  return baseDelayMs * 2 ** (attempt - 1);
}

function waitForRetry(delayMs: number, signal?: AbortSignal): Promise<void> {
  throwIfStopped(signal);
  if (delayMs === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const stopWaiting = () => {
      clearTimeout(timeoutId);
      reject(new Error('已停止翻译'));
    };
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', stopWaiting);
      resolve();
    }, delayMs);
    signal?.addEventListener('abort', stopWaiting, { once: true });
  });
}

function throwIfStopped(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('已停止翻译');
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
