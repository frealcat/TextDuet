/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { createOperationQueue } from '@/src/storage/operation-queue';

describe('storage operation queue', () => {
  it('keeps a clear operation behind an in-flight cache write', async () => {
    const enqueue = createOperationQueue();
    let releaseWrite!: () => void;
    const order: string[] = [];
    const write = enqueue(async () => {
      order.push('write:start');
      await new Promise<void>((resolve) => { releaseWrite = resolve; });
      order.push('write:end');
    });
    const clear = enqueue(async () => {
      order.push('clear');
    });

    await Promise.resolve();
    expect(order).toEqual(['write:start']);
    releaseWrite();
    await Promise.all([write, clear]);
    expect(order).toEqual(['write:start', 'write:end', 'clear']);
  });

  it('continues with the next operation after a failure', async () => {
    const enqueue = createOperationQueue();
    const first = enqueue(async () => {
      throw new Error('write failed');
    });
    const second = enqueue(async () => 'clear complete');

    await expect(first).rejects.toThrow('write failed');
    await expect(second).resolves.toBe('clear complete');
  });
});
