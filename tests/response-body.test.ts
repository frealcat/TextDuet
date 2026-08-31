/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  readJsonResponseWithLimit,
  ResponseBodyTooLargeError,
} from '@/src/providers/response-body';

describe('bounded provider response reader', () => {
  it('preserves the size error when reader.cancel rejects', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('123456'));
      },
      cancel() {
        return Promise.reject(new Error('simulated cancel failure'));
      },
    });
    const response = new Response(body);

    await expect(readJsonResponseWithLimit(response, 5)).rejects.toBeInstanceOf(
      ResponseBodyTooLargeError,
    );
  });
});
