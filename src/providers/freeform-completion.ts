// Freeform chat-completion helper used by non-block translation flows
// (currently: user-locale dictionary translation). The translation
// pipeline's OpenAiCompatibleProvider is block-shaped (parsed JSON
// with `id / translation`); the i18n prompt just wants raw text back.
//
// This helper reuses the same reliability wrapper, URL resolution,
// and provider-specific request options as the translation provider
// so behavior stays consistent: HTTPS only, timeouts, retries on
// transient 5xx / 429 / network, abortable, no remote code.

import { fetchWithReliability } from './fetch-with-reliability';
import {
  resolveChatCompletionsUrl,
  resolveProviderSpecificRequestOptions,
} from './openai-compatible';
import type { ProviderSettings } from '@/src/core/contracts';

export interface FreeformCompletionRequest {
  system: string;
  user: string;
  /** JSON mode where possible; falls back to plain text otherwise. */
  jsonMode?: boolean;
  /** Lower sampling temperature for deterministic output. */
  temperature?: number;
}

export interface FreeformCompletionResult {
  content: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export class FreeformCompletionError extends Error {
  readonly status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'FreeformCompletionError';
    this.status = status;
  }
}

export interface FreeformCompletionOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
  signal?: AbortSignal;
}

/**
 * Send a system + user prompt to the configured chat-completions
 * endpoint and return the raw assistant content. Throws on HTTP,
 * network, abort, and missing-content errors.
 */
export async function requestFreeformCompletion(
  settings: ProviderSettings,
  apiKey: string,
  request: FreeformCompletionRequest,
  options: FreeformCompletionOptions = {},
): Promise<FreeformCompletionResult> {
  if (!apiKey) {
    throw new FreeformCompletionError('未配置 API Key');
  }
  const body: Record<string, unknown> = {
    model: settings.model,
    temperature: request.temperature ?? 0.1,
    ...resolveProviderSpecificRequestOptions(settings),
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: request.user },
    ],
  };
  if (request.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetchWithReliability(
    resolveChatCompletionsUrl(settings.baseUrl),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    {
      timeoutMs: options.timeoutMs ?? 30_000,
      maxAttempts: options.maxAttempts ?? 2,
      retryBaseDelayMs: options.retryBaseDelayMs ?? 500,
      signal: options.signal,
    },
  );

  if (!response.ok) {
    throw new FreeformCompletionError(
      `Provider returned HTTP ${response.status}`,
      response.status,
    );
  }

  const raw: unknown = await response.json().catch(() => ({}));
  const choices = (raw as { choices?: Array<{ message?: { content?: string } }> }).choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    throw new FreeformCompletionError('模型没有返回可用的内容');
  }
  const usage = (raw as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;
  const model = (raw as { model?: string }).model || settings.model;
  return {
    content,
    model,
    inputTokens: usage?.prompt_tokens,
    outputTokens: usage?.completion_tokens,
  };
}
