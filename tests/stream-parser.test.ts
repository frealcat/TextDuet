import { describe, expect, it } from 'vitest';
import { extractCompletedBlocks, parseSsePayload, splitSseLines } from '@/src/providers/stream-parser';

describe('stream parser', () => {
  it('splits SSE events across chunk boundaries', () => {
    expect(splitSseLines('data: one\n\ndata: two')).toEqual({ events: ['data: one'], remainder: 'data: two' });
  });

  it('parses done and usage events', () => {
    expect(parseSsePayload('[DONE]')).toEqual({ done: true });
    expect(parseSsePayload('{"usage":{"prompt_tokens":3,"completion_tokens":2}}')).toEqual({
      done: false, usage: { prompt_tokens: 3, completion_tokens: 2 },
    });
  });

  it('extracts completed block objects before the full envelope is complete', () => {
    const content = '{"blocks":[{"id":"one","translatedText":"一"},{"id":"two","translatedText":"二"';
    expect(extractCompletedBlocks(content, new Set(['one', 'two']), new Set())).toEqual([{
      id: 'one', translatedText: '一',
    }]);
  });
});
