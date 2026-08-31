/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Serializes asynchronous operations while allowing one failed operation to
 * leave the queue usable for the next caller.
 */
export function createOperationQueue(): <T>(operation: () => Promise<T>) => Promise<T> {
  let tail: Promise<void> = Promise.resolve();

  return <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation, operation);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
