import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  OpenAiCompatibleProvider,
  parseTranslatedBlocks,
  resolveChatCompletionsUrl,
  resolveProviderSpecificRequestOptions,
} from '@/src/providers/openai-compatible';
import type { ProviderSettings, TranslationBatchRequest } from '@/src/core/contracts';

const request: TranslationBatchRequest = {
  sourceLanguage: 'en',
  targetLanguage: 'zh-CN',
  blocks: [
    { id: 'block-1', text: 'Hello' },
    { id: 'block-2', text: 'World' },
  ],
};

const settings: ProviderSettings = {
  provider: 'openai-compatible',
  baseUrl: 'https://api.example.com/v1',
  model: 'example-model',
  apiKeyPersistence: 'session',
  targetLanguage: 'zh-CN',
  displayMode: 'bilingual',
  customSystemPrompt: '',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveChatCompletionsUrl', () => {
  it('appends the compatible endpoint to a base URL', () => {
    expect(resolveChatCompletionsUrl('https://api.example.com/v1')).toBe(
      'https://api.example.com/v1/chat/completions',
    );
  });

  it('does not append the endpoint twice', () => {
    expect(
      resolveChatCompletionsUrl('https://api.example.com/v1/chat/completions/'),
    ).toBe('https://api.example.com/v1/chat/completions');
  });
});

describe('resolveProviderSpecificRequestOptions', () => {
  it('disables thinking for Qwen3 models on Alibaba Cloud endpoints', () => {
    expect(
      resolveProviderSpecificRequestOptions({
        ...settings,
        baseUrl: 'https://regional-gateway.example.aliyuncs.com/compatible-mode/v1',
        model: 'qwen3-plus',
      }),
    ).toEqual({ enable_thinking: false });
  });

  it('does not send Alibaba-specific fields to other compatible providers', () => {
    expect(
      resolveProviderSpecificRequestOptions({
        ...settings,
        baseUrl: 'https://api.example.com/v1',
        model: 'qwen3-compatible-alias',
      }),
    ).toEqual({});
  });
});

describe('parseTranslatedBlocks', () => {
  it('accepts a fenced JSON response with the exact expected IDs', () => {
    expect(
      parseTranslatedBlocks(
        '```json\n{"blocks":[{"id":"block-2","translatedText":"世界"},{"id":"block-1","translatedText":"你好"}]}\n```',
        request,
      ),
    ).toEqual([
      { id: 'block-2', translatedText: '世界' },
      { id: 'block-1', translatedText: '你好' },
    ]);
  });

  it('accepts only the restricted readable-color preference values', () => {
    expect(parseTranslatedBlocks(
      '{"blocks":[{"id":"block-1","translatedText":"你好","colorPreference":"source"},{"id":"block-2","translatedText":"世界","colorPreference":"preferred"}]}',
      request,
    )).toEqual([
      { id: 'block-1', translatedText: '你好', colorPreference: 'source' },
      { id: 'block-2', translatedText: '世界', colorPreference: 'preferred' },
    ]);
    expect(() => parseTranslatedBlocks(
      '{"blocks":[{"id":"block-1","translatedText":"你好","colorPreference":"red"},{"id":"block-2","translatedText":"世界"}]}',
      request,
    )).toThrow('模型返回的段落格式不正确');
  });

  it('rejects duplicate IDs even when the item count matches', () => {
    expect(() =>
      parseTranslatedBlocks(
        '{"blocks":[{"id":"block-1","translatedText":"你好"},{"id":"block-1","translatedText":"再次"}]}',
        request,
      ),
    ).toThrow('模型返回的段落数量不正确');
  });

  it('rejects unexpected fields and non-JSON model output', () => {
    expect(() =>
      parseTranslatedBlocks(
        '{"blocks":[{"id":"block-1","translatedText":"你好","html":"<b>你好</b>"},{"id":"block-2","translatedText":"世界"}]}',
        request,
      ),
    ).toThrow('模型返回的段落格式不正确');

    expect(() => parseTranslatedBlocks('not-json', request)).toThrow(
      '模型返回的内容不是有效 JSON',
    );
  });
});

describe('OpenAiCompatibleProvider', () => {
  it('streams completed blocks before the final done event and records usage', async () => {
    const events = [
      { choices: [{ delta: { content: '{\"blocks\":[{\"id\":\"block-1\",\"translatedText\":\"你好\"},' } }] },
      { choices: [{ delta: { content: '{\"id\":\"block-2\",\"translatedText\":\"世界\"}]}' } }] },
      { usage: { prompt_tokens: 10, completion_tokens: 8 }, choices: [] },
    ];
    const body = `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')}data: [DONE]\n\n`;
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const blocks: unknown[] = [];
    const provider = new OpenAiCompatibleProvider({ retryBaseDelayMs: 0 });
    await expect(provider.translateStream(settings, 'placeholder-api-key', request, {
      onBlock: (block) => blocks.push(block),
    })).resolves.toMatchObject({
      model: 'example-model',
      usage: { inputTokens: 10, outputTokens: 8, kind: 'actual' },
      isStreaming: true,
    });
    expect(blocks).toEqual([
      { id: 'block-1', translatedText: '你好' },
      { id: 'block-2', translatedText: '世界' },
    ]);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(requestBody).toMatchObject({ stream: true, stream_options: { include_usage: true } });
  });

  it('falls back to ordinary JSON in the same streaming call', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{\"blocks\":[{\"id\":\"block-1\",\"translatedText\":\"你好\"},{\"id\":\"block-2\",\"translatedText\":\"世界\"}]}' } }],
      usage: { prompt_tokens: 4, completion_tokens: 5 },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAiCompatibleProvider({ retryBaseDelayMs: 0 });
    await expect(provider.translateStream(settings, 'placeholder-api-key', request)).resolves.toMatchObject({
      isStreaming: false,
      usage: { inputTokens: 4, outputTokens: 5, kind: 'actual' },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects an incomplete SSE stream after retaining no incomplete block', async () => {
    const body = `data: ${JSON.stringify({ choices: [{ delta: { content: '{\"blocks\":[{\"id\":\"block-1\",\"translatedText\":\"你好\"}]' } }] })}\n\n`;
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const blocks: unknown[] = [];
    const provider = new OpenAiCompatibleProvider({ retryBaseDelayMs: 0 });
    await expect(provider.translateStream(settings, 'placeholder-api-key', request, {
      onBlock: (block) => blocks.push(block),
    })).rejects.toThrow('模型流式响应未完整结束');
    expect(blocks).toEqual([{ id: 'block-1', translatedText: '你好' }]);
  });

  it('returns a validated translation from a compatible endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: 'resolved-model',
          usage: { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 },
          choices: [
            {
              message: {
                content:
                  '{"blocks":[{"id":"block-1","translatedText":"你好"},{"id":"block-2","translatedText":"世界"}]}',
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAiCompatibleProvider({ retryBaseDelayMs: 0 });

    await expect(provider.translate(settings, 'placeholder-api-key', request)).resolves.toEqual({
      model: 'resolved-model',
      blocks: [
        { id: 'block-1', translatedText: '你好' },
        { id: 'block-2', translatedText: '世界' },
      ],
      usage: { inputTokens: 120, outputTokens: 80, kind: 'actual' },
    });

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(requestBody).not.toHaveProperty('enable_thinking');
  });

  it('includes the non-thinking option in Alibaba Qwen3 request bodies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '{"blocks":[{"id":"block-1","translatedText":"你好"},{"id":"block-2","translatedText":"世界"}]}',
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAiCompatibleProvider({ retryBaseDelayMs: 0 });

    await provider.translate(
      {
        ...settings,
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen3-plus',
      },
      'placeholder-api-key',
      request,
    );

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(requestBody).toMatchObject({
      model: 'qwen3-plus',
      temperature: 0.1,
      enable_thinking: false,
    });
    expect(requestBody.messages).toBeInstanceOf(Array);
  });

  it('does not retry a 401 response and returns an actionable safe error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('private body', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAiCompatibleProvider({ retryBaseDelayMs: 0 });

    await expect(provider.translate(settings, 'placeholder-api-key', request)).rejects.toThrow(
      '模型服务拒绝认证，请检查 API Key、组织或模型权限',
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('bounds 429 retries and never exposes the remote response body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('private body', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAiCompatibleProvider({ retryBaseDelayMs: 0 });

    await expect(provider.translate(settings, 'placeholder-api-key', request)).rejects.toThrow(
      '模型服务在多次重试后仍然限流，请稍后再试',
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
