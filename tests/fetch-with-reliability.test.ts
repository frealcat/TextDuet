import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithReliability } from '@/src/providers/fetch-with-reliability';

const options = {
  timeoutMs: 100,
  maxAttempts: 3,
  retryBaseDelayMs: 0,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchWithReliability', () => {
  it('retries 429 and 5xx responses before returning a success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithReliability('https://api.example.com/v1', {}, options);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry authentication failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithReliability('https://api.example.com/v1', {}, options);

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('retries network failures only up to the configured attempt limit', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('private network detail'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchWithReliability('https://api.example.com/v1', {}, options),
    ).rejects.toThrow('多次重试后仍无法连接模型服务，请检查网络');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('maps a per-attempt timeout to a safe product error', async () => {
    const fetchMock = vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchWithReliability('https://api.example.com/v1', {}, {
        ...options,
        timeoutMs: 5,
        maxAttempts: 1,
      }),
    ).rejects.toThrow('模型请求超时，请检查网络后重试');
  });

  it('cancels an in-flight request without exposing the fetch error', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('private abort detail', 'AbortError'));
        });
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const request = fetchWithReliability('https://api.example.com/v1', {}, {
      ...options,
      signal: controller.signal,
    });
    controller.abort();

    await expect(request).rejects.toThrow('已停止翻译');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
