import type { TranslatedBlock } from '@/src/core/contracts';
import { TranslatedBlockSchema } from '@/src/core/schemas';
import * as z from 'zod/mini';

const StreamUsageShapeSchema = z.object({
  prompt_tokens: z.optional(z.number()),
  completion_tokens: z.optional(z.number()),
});

const StreamChoiceSchema = z.object({
  delta: z.optional(z.object({
    content: z.optional(z.nullable(z.string().check(z.maxLength(64_000)))),
  })),
  message: z.optional(z.object({
    content: z.optional(z.nullable(z.string().check(z.maxLength(64_000)))),
  })),
});

// Provider SSE envelopes legitimately carry provider-specific metadata. The
// schema validates every field we consume while allowing unknown metadata to
// remain harmless and ignored.
const StreamPayloadSchema = z.object({
  model: z.optional(z.string().check(z.minLength(1), z.maxLength(256))),
  choices: z.optional(z.array(StreamChoiceSchema)),
  usage: z.optional(z.nullable(StreamUsageShapeSchema)),
});

export interface ParsedStreamEvent {
  content?: string;
  model?: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
  done: boolean;
}

export function parseSsePayload(payload: string): ParsedStreamEvent {
  if (payload.trim() === '[DONE]') return { done: true };
  let decoded: unknown;
  try {
    decoded = JSON.parse(payload);
  } catch {
    throw new Error('模型流式响应格式无效');
  }
  const parsed = StreamPayloadSchema.safeParse(decoded);
  if (!parsed.success) throw new Error('模型流式响应格式无效');
  const value = parsed.data;
  const choice = value.choices?.[0];
  const model = value.model;
  const promptTokens = value.usage?.prompt_tokens;
  const completionTokens = value.usage?.completion_tokens;
  const usage = Number.isSafeInteger(promptTokens) && Number.isSafeInteger(completionTokens)
    && (promptTokens as number) >= 0 && (completionTokens as number) >= 0
    && (promptTokens as number) <= 1_000_000_000 && (completionTokens as number) <= 1_000_000_000
    ? { prompt_tokens: promptTokens as number, completion_tokens: completionTokens as number }
    : undefined;
  return { model, content: choice?.delta?.content ?? choice?.message?.content ?? undefined, usage, done: false };
}

export function splitSseLines(buffer: string): { events: string[]; remainder: string } {
  const normalized = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const parts = normalized.split('\n\n');
  return { events: parts.slice(0, -1), remainder: parts.at(-1) || '' };
}

export function extractCompletedBlocks(
  content: string,
  expectedIds: ReadonlySet<string>,
  emittedIds: ReadonlySet<string>,
): TranslatedBlock[] {
  const blocks: TranslatedBlock[] = [];
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] !== '{') continue;
    const end = findJsonObjectEnd(content, index);
    if (end < 0) continue;
    try {
      const parsed: unknown = JSON.parse(content.slice(index, end + 1));
      const result = TranslatedBlockSchema.safeParse(parsed);
      if (result.success && expectedIds.has(result.data.id) && !emittedIds.has(result.data.id)) {
        blocks.push(result.data);
      }
    } catch {
      // The object may be a parent object or a partial candidate; wait for more data.
    }
    // Keep scanning nested objects so a surrounding {"blocks": [...]} envelope
    // does not hide completed block objects from the incremental parser.
  }
  return blocks;
}

function findJsonObjectEnd(value: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}' && --depth === 0) return index;
  }
  return -1;
}
