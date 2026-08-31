/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { createStorageReadiness } from '@/src/background/storage-readiness';

describe('storage readiness gate', () => {
  it('shares a successful initialization across concurrent callers', async () => {
    let resolveInitialization!: () => void;
    const initialize = vi.fn(() => new Promise<void>((resolve) => {
      resolveInitialization = resolve;
    }));
    const readiness = createStorageReadiness(initialize);

    const first = readiness.ensure();
    const second = readiness.ensure();
    expect(initialize).toHaveBeenCalledOnce();
    expect(first).toBe(second);

    resolveInitialization();
    await Promise.all([first, second]);
    expect(initialize).toHaveBeenCalledOnce();
  });

  it('allows a later operation to retry after initialization fails', async () => {
    const initialize = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce(undefined);
    const readiness = createStorageReadiness(initialize);

    await expect(readiness.run(async () => 'first')).rejects.toThrow('storage unavailable');
    await expect(readiness.run(async () => 'second')).resolves.toBe('second');
    expect(initialize).toHaveBeenCalledTimes(2);
  });

  it('does not run a protected operation when initialization rejects', async () => {
    const operation = vi.fn(async () => undefined);
    const readiness = createStorageReadiness(async () => {
      throw new Error('not ready');
    });

    await expect(readiness.run(operation)).rejects.toThrow('not ready');
    expect(operation).not.toHaveBeenCalled();
  });
});
