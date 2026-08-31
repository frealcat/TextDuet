/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_FREEFORM_RESPONSE_BYTES,
  requestFreeformCompletion,
} from '@/src/providers/freeform-completion';

const settings = {
  provider: 'openai-compatible' as const,
  baseUrl: 'https://api.example.com/v1',
  model: 'example-model',
  apiKeyPersistence: 'session' as const,
  targetLanguage: 'zh-CN',
  displayMode: 'bilingual' as const,
  customSystemPrompt: '',
};

describe('freeform completion response limits', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns validated assistant content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: 'resolved-model',
      choices: [{ message: { content: '{"hello":"你好"}' } }],
      usage: { prompt_tokens: 2, completion_tokens: 3 },
    }), { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);
    await expect(requestFreeformCompletion(
      settings,
      'local-test-placeholder',
      { system: 'system', user: 'user', jsonMode: true },
      { maxAttempts: 1 },
    )).resolves.toEqual({
      content: '{"hello":"你好"}',
      model: 'resolved-model',
      inputTokens: 2,
      outputTokens: 3,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects an oversized non-streaming response before JSON parsing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      new Uint8Array(MAX_FREEFORM_RESPONSE_BYTES + 1),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestFreeformCompletion(
      settings,
      'local-test-placeholder',
      { system: 'system', user: 'user' },
      { maxAttempts: 1 },
    )).rejects.toThrow('模型接口响应超过大小限制');
  });
});
