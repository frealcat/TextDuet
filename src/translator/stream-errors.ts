/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

/** Errors that should leave source blocks eligible for a later lifecycle scan. */
export class TranslationLifecycleDisconnectError extends Error {
  readonly retryable = true;

  constructor(message = '流式翻译连接已断开') {
    super(message);
    this.name = 'TranslationLifecycleDisconnectError';
  }
}

/** Chrome's synchronous Port errors when a document is being torn down. */
const LIFECYCLE_DISCONNECT_PATTERN = /(?:message\s+)?port\s+(?:is\s+)?(?:closed|disconnected)|disconnected\s+port|message\s+channel\s+(?:is\s+)?closed|back\/forward\s+cache|receiving\s+end\s+does\s+not\s+exist|extension\s+context\s+invalidated|context\s+was\s+invalidated/i;

export function isLikelyTranslationLifecycleDisconnect(error: unknown): boolean {
  if (error instanceof TranslationLifecycleDisconnectError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return LIFECYCLE_DISCONNECT_PATTERN.test(message);
}

/**
 * Normalizes a synchronous Port.postMessage lifecycle failure to the same
 * error used by the asynchronous onDisconnect path. A non-lifecycle error is
 * preserved so serialization/programming bugs still surface as ordinary
 * failures instead of being retried forever.
 */
export function normalizeTranslationStreamSendError(error: unknown): Error {
  if (error instanceof TranslationLifecycleDisconnectError) return error;
  if (isLikelyTranslationLifecycleDisconnect(error)) return new TranslationLifecycleDisconnectError();
  if (error instanceof Error) return error;
  return new Error(String(error));
}

/** Keeps lifecycle cancellation separate from provider/network failures. */
export function isRetryableTranslationError(error: unknown): boolean {
  return error instanceof Error
    && (error as Error & { retryable?: unknown }).retryable === true;
}

/** Pure state transition used by the scan loop after a lifecycle disconnect. */
export function requeueAfterLifecycleDisconnect(
  failedIds: Set<string>,
  blockIds: readonly string[],
): void {
  blockIds.forEach((id) => failedIds.delete(id));
}
