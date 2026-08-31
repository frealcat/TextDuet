/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  isRetryableTranslationError,
  isLikelyTranslationLifecycleDisconnect,
  normalizeTranslationStreamSendError,
  requeueAfterLifecycleDisconnect,
  TranslationLifecycleDisconnectError,
} from '@/src/translator/stream-errors';

describe('translation lifecycle retry policy', () => {
  it('marks only lifecycle disconnects as retryable', () => {
    expect(isRetryableTranslationError(new TranslationLifecycleDisconnectError())).toBe(true);
    expect(isRetryableTranslationError(new Error('provider unavailable'))).toBe(false);
    expect(isRetryableTranslationError(null)).toBe(false);
  });

  it('normalizes synchronous stream-port send failures as lifecycle disconnects', () => {
    const messages = [
      'The message port closed before a response was received',
      'The page keeping the extension port is moved into the back/forward cache, so the message channel is closed',
      'Attempting to use a disconnected port object',
      'Could not establish connection. Receiving end does not exist.',
    ];

    for (const message of messages) {
      const original = new Error(message);
      const normalized = normalizeTranslationStreamSendError(original);
      expect(isLikelyTranslationLifecycleDisconnect(original)).toBe(true);
      expect(normalized).toBeInstanceOf(TranslationLifecycleDisconnectError);
      expect(normalized).not.toBe(original);
      expect(isRetryableTranslationError(normalized)).toBe(true);
      expect(normalized.message).toBe('流式翻译连接已断开');
    }
  });

  it('does not replace an already-normalized lifecycle error', () => {
    const original = new TranslationLifecycleDisconnectError('页面生命周期已结束');
    expect(normalizeTranslationStreamSendError(original)).toBe(original);
  });

  it('preserves non-lifecycle send failures', () => {
    const original = new Error('Could not clone the request payload');

    expect(isLikelyTranslationLifecycleDisconnect(original)).toBe(false);
    expect(normalizeTranslationStreamSendError(original)).toBe(original);
  });

  it('requeues disconnected blocks without touching unrelated failures', () => {
    const failed = new Set(['one', 'two', 'other']);
    requeueAfterLifecycleDisconnect(failed, ['one', 'two']);
    expect([...failed]).toEqual(['other']);
  });
});
