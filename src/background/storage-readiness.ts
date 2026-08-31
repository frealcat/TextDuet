/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Coordinates one-time Service Worker initialization with retry-on-failure
 * semantics. A successful initialization is shared for the lifetime of the
 * worker; a rejected attempt is discarded so a later event can retry it.
 */
export interface StorageReadiness {
  ensure(): Promise<void>;
  run<T>(operation: () => Promise<T>): Promise<T>;
}

export function createStorageReadiness(
  initialize: () => Promise<void>,
): StorageReadiness {
  let ready: Promise<void> | undefined;

  function ensure(): Promise<void> {
    if (ready) return ready;

    const attempt = initialize();
    let guardedAttempt: Promise<void>;
    guardedAttempt = attempt.catch((error: unknown) => {
      if (ready === guardedAttempt) ready = undefined;
      throw error;
    });
    ready = guardedAttempt;
    return guardedAttempt;
  }

  return {
    ensure,
    run<T>(operation: () => Promise<T>): Promise<T> {
      return ensure().then(operation);
    },
  };
}
