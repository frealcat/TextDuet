/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { createStreamRequestController } from '@/src/background/stream-request-controller';

describe('stream request controller', () => {
  it('allows sequential requests to receive distinct controllers', () => {
    const gate = createStreamRequestController();
    const first = gate.start();
    expect(first).toBeInstanceOf(AbortController);
    expect(gate.start()).toBeNull();

    gate.finish(first!);
    const second = gate.start();
    expect(second).toBeInstanceOf(AbortController);
    expect(second).not.toBe(first);
  });

  it('aborts and closes the active request exactly once', () => {
    const gate = createStreamRequestController();
    const controller = gate.start()!;
    let aborts = 0;
    controller.signal.addEventListener('abort', () => { aborts += 1; });

    expect(gate.close()).toBe(controller);
    controller.abort();
    expect(aborts).toBe(1);
    expect(gate.close()).toBeNull();
    expect(gate.start()).toBeNull();
    expect(gate.isClosed()).toBe(true);
  });

  it('does not clear a newer request when an older finally arrives late', () => {
    const gate = createStreamRequestController();
    const first = gate.start()!;
    gate.finish(first);
    const second = gate.start()!;

    gate.finish(first);
    expect(gate.start()).toBeNull();
    gate.finish(second);
    expect(gate.start()).toBeInstanceOf(AbortController);
  });
});
