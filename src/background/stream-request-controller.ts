/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Serial request gate for one runtime stream Port.
 *
 * A content script normally creates one Port per batch, but keeping the gate
 * independent of that convention makes the Service Worker safe when a caller
 * reuses a Port. Each accepted request receives a fresh AbortController, and
 * closing the Port prevents any later request from reusing a detached one.
 */
export interface StreamRequestController {
  isClosed(): boolean;
  start(): AbortController | null;
  finish(controller: AbortController): void;
  close(): AbortController | null;
}

export function createStreamRequestController(): StreamRequestController {
  let closed = false;
  let active: AbortController | null = null;

  return {
    isClosed: () => closed,
    start: () => {
      if (closed || active) return null;
      active = new AbortController();
      return active;
    },
    finish: (controller) => {
      if (active === controller) active = null;
    },
    close: () => {
      closed = true;
      const controller = active;
      active = null;
      return controller;
    },
  };
}
