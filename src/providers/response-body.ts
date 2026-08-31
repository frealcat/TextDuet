/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

/** Maximum size accepted for a non-streaming Provider response. */
export const MAX_JSON_RESPONSE_BYTES = 20 * 1024 * 1024;

/** Raised before an untrusted response can grow the worker's heap without a bound. */
export class ResponseBodyTooLargeError extends Error {
  constructor() {
    super('响应体超过大小限制');
    this.name = 'ResponseBodyTooLargeError';
  }
}

/** Reads and parses JSON without relying on Response.json(), which buffers it unboundedly. */
export async function readJsonResponseWithLimit(
  response: Response,
  maxBytes = MAX_JSON_RESPONSE_BYTES,
): Promise<unknown> {
  const text = await readResponseTextWithLimit(response, maxBytes);
  return JSON.parse(text);
}

/** Reads a response body incrementally and enforces a UTF-8 byte ceiling. */
export async function readResponseTextWithLimit(
  response: Response,
  maxBytes = MAX_JSON_RESPONSE_BYTES,
): Promise<string> {
  if (!Number.isFinite(maxBytes) || maxBytes < 0) {
    throw new RangeError('响应体大小上限必须是非负有限数');
  }
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ResponseBodyTooLargeError();
  }

  if (!response.body) {
    // A body-less response is small by definition. Returning an empty string
    // lets callers report their normal JSON/schema error.
    return '';
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      totalBytes += chunk.value?.byteLength ?? 0;
      if (totalBytes > maxBytes) {
        await cancelReaderQuietly(reader);
        throw new ResponseBodyTooLargeError();
      }
      text += decoder.decode(chunk.value || new Uint8Array(), { stream: !chunk.done });
      if (chunk.done) break;
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

export async function cancelReaderQuietly(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<void> {
  try {
    await reader.cancel();
  } catch {
    // A provider may reject cancellation after closing the stream. The
    // original size/parse error is the actionable failure for the caller.
  }
}
