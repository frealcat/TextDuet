/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MemoryItem {
  getValue: () => Promise<unknown>;
  setValue: (value: unknown) => Promise<void>;
  removeValue: (options?: unknown) => Promise<void>;
  watch: (callback: (...values: unknown[]) => void) => () => void;
}

/**
 * Keep the real Vault implementation under test while replacing only WXT's
 * storage adapter. The failure queues let us exercise each destructive phase
 * without depending on browser storage internals.
 */
const memoryStorage = vi.hoisted(() => {
  const values = new Map<string, unknown>();
  const failNextSet = new Map<string, number>();
  const failNextRemove = new Map<string, number>();
  const setCalls = new Map<string, number>();
  const removeCalls = new Map<string, number>();
  const items = new Map<string, MemoryItem>();

  function defineItem(key: string, options?: { fallback?: unknown }): MemoryItem {
    const existing = items.get(key);
    if (existing) return existing;

    const item: MemoryItem = {
      async getValue() {
        return values.has(key) ? values.get(key) : options?.fallback;
      },
      async setValue(value: unknown) {
        setCalls.set(key, (setCalls.get(key) ?? 0) + 1);
        const remainingFailures = failNextSet.get(key) ?? 0;
        if (remainingFailures > 0) {
          failNextSet.set(key, remainingFailures - 1);
          throw new Error(`simulated storage write failure: ${key}`);
        }
        values.set(key, value);
      },
      async removeValue() {
        removeCalls.set(key, (removeCalls.get(key) ?? 0) + 1);
        const remainingFailures = failNextRemove.get(key) ?? 0;
        if (remainingFailures > 0) {
          failNextRemove.set(key, remainingFailures - 1);
          throw new Error(`simulated storage remove failure: ${key}`);
        }
        values.delete(key);
      },
      watch() {
        return () => undefined;
      },
    };
    items.set(key, item);
    return item;
  }

  function reset(): void {
    values.clear();
    failNextSet.clear();
    failNextRemove.clear();
    setCalls.clear();
    removeCalls.clear();
  }

  return {
    storage: { defineItem },
    values,
    failNextSet,
    failNextRemove,
    setCalls,
    removeCalls,
    reset,
  };
});

vi.mock('#imports', () => ({ storage: memoryStorage.storage }));
vi.mock('wxt/utils/storage', () => ({ storage: memoryStorage.storage }));

const LOCAL_VAULT_KEY = 'local:textduet.vault';
const SESSION_UNLOCK_KEY = 'session:textduet.vault.unlock';
const PASSWORD = 'correct horse battery staple';

async function loadVault() {
  vi.resetModules();
  return import('@/src/storage/vault');
}

async function createTestVault() {
  const vault = await loadVault();
  await vault.createVault(PASSWORD);
  expect(memoryStorage.values.get(LOCAL_VAULT_KEY)).toBeTruthy();
  expect(memoryStorage.values.get(SESSION_UNLOCK_KEY)).toBeTruthy();
  return vault;
}

describe('Vault storage failure boundaries', () => {
  beforeEach(() => {
    memoryStorage.reset();
  });

  it('cleans the local envelope when session unlock material cannot be written', async () => {
    const vault = await loadVault();
    memoryStorage.failNextSet.set(SESSION_UNLOCK_KEY, 1);

    await expect(vault.createVault(PASSWORD)).rejects.toThrow(
      `simulated storage write failure: ${SESSION_UNLOCK_KEY}`,
    );

    expect(memoryStorage.values.get(LOCAL_VAULT_KEY)).toBeUndefined();
    expect(memoryStorage.values.get(SESSION_UNLOCK_KEY)).toBeUndefined();
    expect(memoryStorage.removeCalls.get(LOCAL_VAULT_KEY)).toBe(1);
  });

  it('fails closed when replacing session unlock material fails', async () => {
    const vault = await createTestVault();
    // Simulate an explicit re-unlock while an earlier browser-session key is
    // still present. The operation must not report an unlock failure while
    // leaving that old material as an apparently successful new unlock.
    memoryStorage.failNextSet.set(SESSION_UNLOCK_KEY, 1);

    await expect(vault.unlockVault(PASSWORD)).rejects.toThrow(
      `simulated storage write failure: ${SESSION_UNLOCK_KEY}`,
    );

    expect(memoryStorage.values.get(LOCAL_VAULT_KEY)).toBeTruthy();
    expect(memoryStorage.values.get(SESSION_UNLOCK_KEY)).toBeUndefined();
    expect(memoryStorage.removeCalls.get(SESSION_UNLOCK_KEY)).toBe(1);
    await expect(vault.getVaultStatus()).resolves.toEqual({
      exists: true,
      isUnlocked: false,
      version: 1,
    });
  });

  it('keeps both stores intact when phase-one session deletion fails', async () => {
    const vault = await createTestVault();
    memoryStorage.failNextRemove.set(SESSION_UNLOCK_KEY, 1);

    await expect(vault.clearVault()).rejects.toThrow(
      `simulated storage remove failure: ${SESSION_UNLOCK_KEY}`,
    );

    expect(memoryStorage.values.get(LOCAL_VAULT_KEY)).toBeTruthy();
    expect(memoryStorage.values.get(SESSION_UNLOCK_KEY)).toBeTruthy();
    expect(memoryStorage.removeCalls.get(LOCAL_VAULT_KEY) ?? 0).toBe(0);
  });

  it('retains local encrypted data when phase-two deletion fails', async () => {
    const vault = await createTestVault();
    memoryStorage.failNextRemove.set(LOCAL_VAULT_KEY, 1);

    await expect(vault.clearVault()).rejects.toThrow(
      `simulated storage remove failure: ${LOCAL_VAULT_KEY}`,
    );

    expect(memoryStorage.values.get(SESSION_UNLOCK_KEY)).toBeUndefined();
    expect(memoryStorage.values.get(LOCAL_VAULT_KEY)).toBeTruthy();
  });

  it('can retry clearVault after either failed deletion phase', async () => {
    const vault = await createTestVault();
    memoryStorage.failNextRemove.set(LOCAL_VAULT_KEY, 1);

    await expect(vault.clearVault()).rejects.toThrow();
    await expect(vault.clearVault()).resolves.toBeUndefined();

    expect(memoryStorage.values.get(LOCAL_VAULT_KEY)).toBeUndefined();
    expect(memoryStorage.values.get(SESSION_UNLOCK_KEY)).toBeUndefined();
  });
});
