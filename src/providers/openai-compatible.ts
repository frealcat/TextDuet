import type {
  ProviderSettings,
  TranslatedBlock,
  TranslationBatchRequest,
} from '@/src/core/contracts';
import { parseConfiguredProviderSettings, TranslatedBlockSchema } from '@/src/core/schemas';
import { resolveSystemPrompt } from '@/src/core/translation-prompt';
import * as z from 'zod/mini';
import { fetchWithReliability } from './fetch-with-reliability';
import type {
  ProviderRequestOptions,
  ProviderTranslationResult,
  TranslationProvider,
} from './types';

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 400;

const ChatCompletionResponseSchema = z.object({
  model: z.optional(z.string().check(z.minLength(1), z.maxLength(256))),
  choices: z.optional(
    z.array(
      z.object({
        message: z.optional(
          z.object({
            content: z.optional(z.nullable(z.string())),
          }),
        ),
      }),
    ),
  ),
  usage: z.optional(
    z.object({
      prompt_tokens: z.int().check(z.nonnegative()),
      completion_tokens: z.int().check(z.nonnegative()),
    }),
  ),
});

const TranslationModelResponseSchema = z.strictObject({
  blocks: z.array(TranslatedBlockSchema).check(z.minLength(1), z.maxLength(200)),
});

interface ProviderReliabilityOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
}

export class OpenAiCompatibleProvider implements TranslationProvider {
  readonly #timeoutMs: number;
  readonly #maxAttempts: number;
  readonly #retryBaseDelayMs: number;

  constructor(options: ProviderReliabilityOptions = {}) {
    this.#timeoutMs = normalizePositiveInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS);
    this.#maxAttempts = normalizePositiveInteger(options.maxAttempts, DEFAULT_MAX_ATTEMPTS);
    this.#retryBaseDelayMs = normalizeNonNegativeInteger(
      options.retryBaseDelayMs,
      DEFAULT_RETRY_BASE_DELAY_MS,
    );
  }

  async translate(
    settings: ProviderSettings,
    apiKey: string,
    request: TranslationBatchRequest,
    options: ProviderRequestOptions = {},
  ): Promise<ProviderTranslationResult> {
    validateConfiguration(settings, apiKey);

    const response = await fetchWithReliability(
      resolveChatCompletionsUrl(settings.baseUrl),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.model,
          temperature: 0.1,
          ...resolveProviderSpecificRequestOptions(settings),
          messages: [
            {
              role: 'system',
              content: resolveSystemPrompt(settings),
            },
            {
              role: 'user',
              content: JSON.stringify(request),
            },
          ],
        }),
      },
      {
        timeoutMs: this.#timeoutMs,
        maxAttempts: this.#maxAttempts,
        retryBaseDelayMs: this.#retryBaseDelayMs,
        signal: options.signal,
      },
    );

    if (!response.ok) {
      throw new Error(describeHttpError(response.status));
    }

    const rawPayload: unknown = await response.json().catch(() => ({}));
    const payloadResult = ChatCompletionResponseSchema.safeParse(rawPayload);
    if (!payloadResult.success) {
      throw new Error('模型接口返回的响应格式不正确');
    }

    const payload = payloadResult.data;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('模型没有返回可用的翻译内容');
    }

    const blocks = parseTranslatedBlocks(content, request);
    return {
      blocks,
      model: payload.model || settings.model,
      usage: payload.usage
        ? {
            inputTokens: payload.usage.prompt_tokens,
            outputTokens: payload.usage.completion_tokens,
            kind: 'actual',
          }
        : undefined,
    };
  }

  async testConnection(
    settings: ProviderSettings,
    apiKey: string,
    options: ProviderRequestOptions = {},
  ): Promise<void> {
    await this.translate(
      settings,
      apiKey,
      {
        sourceLanguage: 'en',
        targetLanguage: settings.targetLanguage,
        blocks: [{ id: 'connection-test', text: 'Connection successful.' }],
      },
      options,
    );
  }
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && (value ?? 0) > 0 ? (value as number) : fallback;
}

function normalizeNonNegativeInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && (value ?? -1) >= 0 ? (value as number) : fallback;
}

export function resolveChatCompletionsUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (normalized.endsWith('/chat/completions')) {
    return normalized;
  }
  return `${normalized}/chat/completions`;
}

export function resolveProviderSpecificRequestOptions(
  settings: ProviderSettings,
): Record<string, unknown> {
  let hostname: string;
  try {
    hostname = new URL(settings.baseUrl).hostname.toLowerCase();
  } catch {
    return {};
  }

  const isAlibabaCloudHost =
    hostname === 'aliyuncs.com' ||
    hostname.endsWith('.aliyuncs.com') ||
    hostname === 'alibabacloud.com' ||
    hostname.endsWith('.alibabacloud.com');
  const isQwen3Model = /(^|[-_/])qwen3([./_-]|$)/i.test(settings.model.trim());

  if (isAlibabaCloudHost && isQwen3Model) {
    return { enable_thinking: false };
  }

  return {};
}

function validateConfiguration(settings: ProviderSettings, apiKey: string): void {
  if (!apiKey.trim()) {
    throw new Error('请先配置 API Key');
  }
  parseConfiguredProviderSettings(settings);
}

export function parseTranslatedBlocks(
  content: string,
  request: TranslationBatchRequest,
): TranslatedBlock[] {
  const jsonText = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('模型返回的内容不是有效 JSON');
  }

  const result = TranslationModelResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('模型返回的段落格式不正确');
  }

  const expectedIds = new Set(request.blocks.map((block) => block.id));
  const receivedIds = new Set(result.data.blocks.map((block) => block.id));

  if (
    result.data.blocks.length !== request.blocks.length ||
    receivedIds.size !== result.data.blocks.length
  ) {
    throw new Error('模型返回的段落数量不正确');
  }

  for (const block of result.data.blocks) {
    if (!expectedIds.has(block.id)) {
      throw new Error('模型返回的段落格式不正确');
    }
  }

  return result.data.blocks;
}

function describeHttpError(status: number): string {
  if (status === 401 || status === 403) {
    return '模型服务拒绝认证，请检查 API Key、组织或模型权限';
  }
  if (status === 402) {
    return '模型服务余额不足，请前往服务商检查账户余额';
  }
  if (status === 404) {
    return '未找到模型接口，请检查 API Base URL 和模型名称';
  }
  if (status === 429) {
    return '模型服务在多次重试后仍然限流，请稍后再试';
  }
  if (status >= 500) {
    return '模型服务在多次重试后仍不可用，请稍后再试';
  }
  return `模型接口返回 HTTP ${status}`;
}
