import type { TranslatedBlock } from '@/src/core/contracts';
import { TranslatedBlockSchema } from '@/src/core/schemas';

export interface ParsedStreamEvent {
  content?: string;
  model?: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
  done: boolean;
}

export function parseSsePayload(payload: string): ParsedStreamEvent {
  if (payload.trim() === '[DONE]') return { done: true };
  const value = JSON.parse(payload) as {
    choices?: Array<{ delta?: { content?: string | null }; message?: { content?: string | null } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const choice = value.choices?.[0];
  const model = typeof (value as { model?: unknown }).model === 'string' ? (value as { model: string }).model : undefined;
  const promptTokens = value.usage?.prompt_tokens;
  const completionTokens = value.usage?.completion_tokens;
  const usage = Number.isInteger(promptTokens) && Number.isInteger(completionTokens)
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
