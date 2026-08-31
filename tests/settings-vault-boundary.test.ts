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

const memoryStorage = vi.hoisted(() => {
  const values = new Map<string, unknown>();
  const failNextSet = new Map<string, number>();
  const failNextRemove = new Map<string, number>();
  const items = new Map<string, MemoryItem>();

  function defineItem(key: string, options?: { fallback?: unknown }): MemoryItem {
    const existing = items.get(key);
    if (existing) return existing;

    const item: MemoryItem = {
      async getValue() {
        return values.has(key) ? values.get(key) : options?.fallback;
      },
      async setValue(value: unknown) {
        const remainingFailures = failNextSet.get(key) ?? 0;
        if (remainingFailures > 0) {
          failNextSet.set(key, remainingFailures - 1);
          throw new Error(`simulated storage write failure: ${key}`);
        }
        values.set(key, value);
      },
      async removeValue() {
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
  }

  return {
    storage: { defineItem },
    values,
    failNextSet,
    failNextRemove,
    reset,
  };
});

const vaultMock = vi.hoisted(() => {
  const persistentKeys = new Map<string, string>();
  let failNextClearPersistent = 0;
  let failNextSavePersistent = 0;

  function originOf(baseUrl: string): string {
    return new URL(baseUrl).origin;
  }

  class MockVaultLockedError extends Error {
    constructor() {
      super('vault is locked');
      this.name = 'VaultLockedError';
    }
  }

  class MockVaultNotInitializedError extends Error {
    constructor() {
      super('vault is not initialized');
      this.name = 'VaultNotInitializedError';
    }
  }

  return {
    VaultLockedError: MockVaultLockedError,
    VaultNotInitializedError: MockVaultNotInitializedError,
    clearPersistentApiKeys: vi.fn(async () => {
      persistentKeys.clear();
      if (failNextClearPersistent > 0) {
        failNextClearPersistent -= 1;
        throw new Error('simulated Vault clear failure');
      }
    }),
    snapshotPersistentApiKeys: vi.fn(async () => ({
      providerApiKeys: Object.fromEntries(persistentKeys),
    })),
    restorePersistentApiKeys: vi.fn(async (snapshot: { providerApiKeys: Record<string, string> }) => {
      persistentKeys.clear();
      for (const [origin, key] of Object.entries(snapshot.providerApiKeys)) {
        persistentKeys.set(origin, key);
      }
    }),
    clearVault: vi.fn(async () => undefined),
    createVault: vi.fn(async () => ({ exists: true, isUnlocked: true, version: 1 })),
    getPersistentApiKey: vi.fn(async (baseUrl: string) => persistentKeys.get(originOf(baseUrl)) ?? ''),
    getVaultStatus: vi.fn(async () => ({
      exists: false,
      isUnlocked: false,
      version: null as number | null,
    })),
    lockVault: vi.fn(async () => ({
      exists: false,
      isUnlocked: false,
      version: null as number | null,
    })),
    savePersistentApiKey: vi.fn(async (baseUrl: string, apiKey: string) => {
      if (failNextSavePersistent > 0) {
        failNextSavePersistent -= 1;
        throw new Error('simulated Vault write failure');
      }
      const origin = originOf(baseUrl);
      const normalized = apiKey.trim();
      if (normalized) persistentKeys.set(origin, normalized);
      else persistentKeys.delete(origin);
    }),
    unlockVault: vi.fn(async () => ({ exists: true, isUnlocked: true, version: 1 })),
    persistentKeys,
    setFailNextClearPersistent(value: number) {
      failNextClearPersistent = value;
    },
    setFailNextSavePersistent(value: number) {
      failNextSavePersistent = value;
    },
  };
});

vi.mock('#imports', () => ({ storage: memoryStorage.storage }));
// WXT resolves the #imports storage export to this concrete module at
// transform time; mock both paths so these tests do not touch browser storage.
vi.mock('wxt/utils/storage', () => ({ storage: memoryStorage.storage }));
vi.mock('@/src/storage/vault', () => vaultMock);

async function loadSettings() {
  vi.resetModules();
  return import('@/src/storage/settings');
}

describe('settings and persistent Vault boundary', () => {
  beforeEach(() => {
    memoryStorage.reset();
    vi.clearAllMocks();
    vaultMock.getVaultStatus.mockResolvedValue({
      exists: false,
      isUnlocked: false,
      version: null,
    });
    vaultMock.getPersistentApiKey.mockImplementation(async (baseUrl: string) => {
      return vaultMock.persistentKeys.get(new URL(baseUrl).origin) ?? '';
    });
    vaultMock.persistentKeys.clear();
    vaultMock.setFailNextClearPersistent(0);
    vaultMock.setFailNextSavePersistent(0);
    vaultMock.clearVault.mockImplementation(async () => undefined);
  });

  it('propagates a locked Vault instead of folding it into an empty key', async () => {
    const settings = await loadSettings();
    const locked = new vaultMock.VaultLockedError();
    vaultMock.getVaultStatus.mockResolvedValue({ exists: true, isUnlocked: false, version: 1 });
    vaultMock.getPersistentApiKey.mockRejectedValue(locked);

    await expect(settings.getApiKey('local', 'https://api.example.com/v1')).rejects.toBe(locked);
  });

  it('propagates an uninitialized Vault so callers can request setup', async () => {
    const settings = await loadSettings();
    const uninitialized = new vaultMock.VaultNotInitializedError();
    vaultMock.getPersistentApiKey.mockRejectedValue(uninitialized);

    await expect(settings.getApiKey('local', 'https://api.example.com/v1')).rejects.toBe(uninitialized);
  });

  it('keeps session key reads independent of persistent Vault state', async () => {
    const settings = await loadSettings();
    memoryStorage.values.set('session:textduet.providerApiKeys', {
      'https://api.example.com': 'session-test-key',
    });
    vaultMock.getVaultStatus.mockResolvedValue({ exists: true, isUnlocked: false, version: 1 });

    await expect(settings.getApiKey('session', 'https://api.example.com/v1')).resolves.toBe('session-test-key');
    expect(vaultMock.getPersistentApiKey).not.toHaveBeenCalled();
  });

  it('rejects a session-mode switch while the persistent Vault is locked', async () => {
    const settings = await loadSettings();
    vaultMock.getVaultStatus.mockResolvedValue({ exists: true, isUnlocked: false, version: 1 });

    await expect(settings.saveApiKey('temporary-session-key', 'session', 'https://api.example.com/v1', { modeChanged: true }))
      .rejects.toBeInstanceOf(vaultMock.VaultLockedError);

    expect(memoryStorage.values.get('session:textduet.providerApiKeys')).toBeUndefined();
    expect(vaultMock.savePersistentApiKey).not.toHaveBeenCalled();
  });

  it('clears a persistent key when switching to session mode with an unlocked Vault', async () => {
    const settings = await loadSettings();
    vaultMock.getVaultStatus.mockResolvedValue({ exists: true, isUnlocked: true, version: 1 });
    vaultMock.persistentKeys.set('https://api.example.com', 'old-local-key');
    vaultMock.persistentKeys.set('https://other.example.com', 'other-local-key');

    await expect(settings.saveApiKey('temporary-session-key', 'session', 'https://api.example.com/v1', { modeChanged: true }))
      .resolves.toBeUndefined();
    expect(vaultMock.persistentKeys).toEqual(new Map([
      ['https://other.example.com', 'other-local-key'],
    ]));
  });

  it('migrates the existing session key when switching to local mode with an empty input', async () => {
    const settings = await loadSettings();
    memoryStorage.values.set('session:textduet.providerApiKeys', {
      'https://api.example.com': 'existing-session-key',
    });
    vaultMock.getVaultStatus.mockResolvedValue({ exists: true, isUnlocked: true, version: 1 });

    await expect(settings.saveApiKey('', 'local', 'https://api.example.com/v1', { modeChanged: true }))
      .resolves.toBeUndefined();

    expect(vaultMock.savePersistentApiKey).toHaveBeenCalledWith(
      'https://api.example.com/v1',
      'existing-session-key',
    );
    expect(memoryStorage.values.get('session:textduet.providerApiKeys')).toBeUndefined();
  });

  it('clears a stale persistent key when switching to local mode without a session source', async () => {
    const settings = await loadSettings();
    vaultMock.getVaultStatus.mockResolvedValue({ exists: true, isUnlocked: true, version: 1 });
    vaultMock.persistentKeys.set('https://api.example.com', 'stale-local-key');

    await expect(settings.saveApiKey('', 'local', 'https://api.example.com/v1', { modeChanged: true }))
      .resolves.toBeUndefined();

    expect(vaultMock.persistentKeys).toEqual(new Map());
    expect(memoryStorage.values.get('session:textduet.providerApiKeys')).toBeUndefined();
    expect(vaultMock.savePersistentApiKey).toHaveBeenCalledWith(
      'https://api.example.com/v1',
      '',
    );
  });

  it('migrates the existing persistent key when switching to session mode with an empty input', async () => {
    const settings = await loadSettings();
    vaultMock.getVaultStatus.mockResolvedValue({ exists: true, isUnlocked: true, version: 1 });
    vaultMock.getPersistentApiKey.mockResolvedValue('existing-local-key');

    await expect(settings.saveApiKey('', 'session', 'https://api.example.com/v1', { modeChanged: true }))
      .resolves.toBeUndefined();

    expect(memoryStorage.values.get('session:textduet.providerApiKeys')).toEqual({
      'https://api.example.com': 'existing-local-key',
    });
    expect(vaultMock.savePersistentApiKey).toHaveBeenCalledWith(
      'https://api.example.com/v1',
      '',
    );
  });

  it('restores session keys if a local-mode switch cannot write the Vault', async () => {
    const settings = await loadSettings();
    memoryStorage.values.set('session:textduet.providerApiKeys', {
      'https://old.example.com': 'old-session-key',
    });
    vaultMock.getVaultStatus.mockResolvedValue({ exists: true, isUnlocked: true, version: 1 });
    vaultMock.savePersistentApiKey.mockRejectedValueOnce(new Error('vault write failed'));

    await expect(settings.saveApiKey(
      'new-local-key',
      'local',
      'https://api.example.com/v1',
      { modeChanged: true },
    )).rejects.toThrow('vault write failed');
    expect(memoryStorage.values.get('session:textduet.providerApiKeys')).toEqual({
      'https://old.example.com': 'old-session-key',
    });
  });

  it('rolls back both stores when local-mode session cleanup fails', async () => {
    const settings = await loadSettings();
    memoryStorage.values.set('session:textduet.providerApiKeys', {
      'https://old.example.com': 'old-session-key',
    });
    vaultMock.getVaultStatus.mockResolvedValue({ exists: true, isUnlocked: true, version: 1 });
    vaultMock.persistentKeys.set('https://existing.example.com', 'existing-local-key');
    // Prime one-time legacy migration before injecting the operation failure.
    await settings.getSessionApiKey('https://api.example.com/v1');
    memoryStorage.failNextRemove.set('session:textduet.providerApiKey', 1);

    await expect(settings.saveApiKey(
      'new-local-key',
      'local',
      'https://api.example.com/v1',
      { modeChanged: true },
    )).rejects.toThrow('simulated storage remove failure');

    expect(memoryStorage.values.get('session:textduet.providerApiKeys')).toEqual({
      'https://old.example.com': 'old-session-key',
    });
    expect(vaultMock.persistentKeys).toEqual(new Map([
      ['https://existing.example.com', 'existing-local-key'],
    ]));
    expect(vaultMock.restorePersistentApiKeys).toHaveBeenCalledOnce();
  });

  it('rolls back the session destination and every Vault key when Vault cleanup fails', async () => {
    const settings = await loadSettings();
    memoryStorage.values.set('session:textduet.providerApiKeys', {
      'https://old.example.com': 'old-session-key',
    });
    vaultMock.getVaultStatus.mockResolvedValue({ exists: true, isUnlocked: true, version: 1 });
    vaultMock.persistentKeys.set('https://api.example.com', 'old-local-key');
    vaultMock.persistentKeys.set('https://other.example.com', 'other-local-key');
    vaultMock.setFailNextSavePersistent(1);

    await expect(settings.saveApiKey(
      'new-session-key',
      'session',
      'https://api.example.com/v1',
      { modeChanged: true },
    )).rejects.toThrow('simulated Vault write failure');

    expect(memoryStorage.values.get('session:textduet.providerApiKeys')).toEqual({
      'https://old.example.com': 'old-session-key',
    });
    expect(vaultMock.persistentKeys).toEqual(new Map([
      ['https://api.example.com', 'old-local-key'],
      ['https://other.example.com', 'other-local-key'],
    ]));
    expect(vaultMock.restorePersistentApiKeys).toHaveBeenCalledOnce();
  });

  it('rolls back secret stores when the settings commit fails', async () => {
    const settings = await loadSettings();
    memoryStorage.values.set('session:textduet.providerApiKeys', {
      'https://old.example.com': 'old-session-key',
    });
    vaultMock.getVaultStatus.mockResolvedValue({ exists: true, isUnlocked: true, version: 1 });
    vaultMock.persistentKeys.set('https://existing.example.com', 'existing-local-key');
    memoryStorage.failNextSet.set('local:textduet.providerSettings', 1);

    await expect(settings.saveApiKey(
      'new-session-key',
      'session',
      'https://api.example.com/v1',
      {
        onCommitted: async () => {
          const raw = memoryStorage.values.get('local:textduet.providerSettings');
          // Exercise the same storage write used by the background save path.
          const item = memoryStorage.storage.defineItem('local:textduet.providerSettings');
          await item.setValue(raw ?? {});
        },
      },
    )).rejects.toThrow('simulated storage write failure');

    expect(memoryStorage.values.get('session:textduet.providerApiKeys')).toEqual({
      'https://old.example.com': 'old-session-key',
    });
    expect(vaultMock.persistentKeys).toEqual(new Map([
      ['https://existing.example.com', 'existing-local-key'],
    ]));
    expect(vaultMock.restorePersistentApiKeys).toHaveBeenCalledOnce();
  });

  it('allows a later read to retry after the initial legacy migration fails', async () => {
    const settings = await loadSettings();
    memoryStorage.values.set('local:textduet.providerSettings', {
      provider: 'openai-compatible',
      baseUrl: 'https://api.example.com/v1',
      model: 'example-model',
      apiKeyPersistence: 'session',
      targetLanguage: 'zh-CN',
      displayMode: 'bilingual',
      customSystemPrompt: '',
      apiKey: 'legacy-session-key',
    });
    memoryStorage.failNextSet.set('session:textduet.providerApiKeys', 1);

    await expect(settings.getSessionApiKey('https://api.example.com/v1')).rejects.toThrow(
      'simulated storage write failure',
    );

    await expect(settings.getSessionApiKey('https://api.example.com/v1')).resolves.toBe('legacy-session-key');
    expect(vaultMock.getVaultStatus).toHaveBeenCalledTimes(2);
    expect(memoryStorage.values.get('local:textduet.providerSettings')).not.toHaveProperty('apiKey');
  });

  it('does not leave a legacy session key in plaintext when the profile is local mode', async () => {
    const settings = await loadSettings();
    const originUrl = 'https://api.example.com/v1';
    memoryStorage.values.set('local:textduet.providerSettings', {
      provider: 'openai-compatible',
      baseUrl: originUrl,
      model: 'example-model',
      apiKeyPersistence: 'local',
      targetLanguage: 'zh-CN',
      displayMode: 'bilingual',
      customSystemPrompt: '',
    });
    memoryStorage.values.set('session:textduet.providerApiKey', 'legacy-session-key');
    vaultMock.getVaultStatus.mockResolvedValue({ exists: true, isUnlocked: true, version: 1 });

    const result = await settings.migrateLegacySecrets();

    expect(result.migratedPersistentKeyCount).toBe(1);
    expect(vaultMock.savePersistentApiKey).toHaveBeenCalledWith('https://api.example.com', 'legacy-session-key');
    expect(memoryStorage.values.get('session:textduet.providerApiKeys')).toBeUndefined();
    expect(memoryStorage.values.get('session:textduet.providerApiKey')).toBeUndefined();
  });

  it('discards a legacy session key in local mode when no unlocked Vault exists', async () => {
    const settings = await loadSettings();
    const originUrl = 'https://api.example.com/v1';
    memoryStorage.values.set('local:textduet.providerSettings', {
      provider: 'openai-compatible',
      baseUrl: originUrl,
      model: 'example-model',
      apiKeyPersistence: 'local',
      targetLanguage: 'zh-CN',
      displayMode: 'bilingual',
      customSystemPrompt: '',
    });
    memoryStorage.values.set('session:textduet.providerApiKey', 'legacy-session-key');
    vaultMock.getVaultStatus.mockResolvedValue({ exists: true, isUnlocked: false, version: 1 });

    const result = await settings.migrateLegacySecrets();

    expect(result.discardedPersistentKeyCount).toBe(1);
    expect(vaultMock.savePersistentApiKey).not.toHaveBeenCalled();
    expect(memoryStorage.values.get('session:textduet.providerApiKeys')).toBeUndefined();
    expect(memoryStorage.values.get('session:textduet.providerApiKey')).toBeUndefined();
  });

  it('removes plaintext slots before reporting a locked Vault', async () => {
    const settings = await loadSettings();
    const originUrl = 'https://api.example.com/v1';
    memoryStorage.values.set('local:textduet.providerSettings', {
      provider: 'openai-compatible',
      baseUrl: originUrl,
      model: 'example-model',
      apiKeyPersistence: 'session',
      targetLanguage: 'zh-CN',
      displayMode: 'bilingual',
      customSystemPrompt: '',
      apiKey: 'legacy-settings-key',
    });
    memoryStorage.values.set('local:textduet.providerApiKey', 'legacy-local-key');
    memoryStorage.values.set('session:textduet.providerApiKey', 'legacy-session-key');
    vaultMock.getVaultStatus.mockResolvedValue({ exists: true, isUnlocked: false, version: 1 });

    await expect(settings.clearApiKeys()).rejects.toBeInstanceOf(vaultMock.VaultLockedError);
    expect(memoryStorage.values.get('local:textduet.providerApiKey')).toBeUndefined();
    expect(memoryStorage.values.get('session:textduet.providerApiKey')).toBeUndefined();
    expect(memoryStorage.values.get('local:textduet.providerSettings')).not.toHaveProperty('apiKey');
  });

  it('never restores plaintext when encrypted Vault cleanup fails', async () => {
    const settings = await loadSettings();
    const originUrl = 'https://api.example.com/v1';
    memoryStorage.values.set('local:textduet.providerSettings', {
      provider: 'openai-compatible',
      baseUrl: originUrl,
      model: 'example-model',
      apiKeyPersistence: 'local',
      targetLanguage: 'zh-CN',
      displayMode: 'bilingual',
      customSystemPrompt: '',
      apiKey: 'legacy-settings-key',
    });
    memoryStorage.values.set('local:textduet.providerApiKey', 'legacy-local-key');
    vaultMock.getVaultStatus.mockResolvedValue({ exists: true, isUnlocked: true, version: 1 });
    vaultMock.persistentKeys.set('https://api.example.com', 'encrypted-key');
    vaultMock.setFailNextClearPersistent(1);

    await expect(settings.clearApiKeys()).rejects.toThrow('simulated Vault clear failure');
    expect(memoryStorage.values.get('local:textduet.providerApiKey')).toBeUndefined();
    expect(memoryStorage.values.get('session:textduet.providerApiKey')).toBeUndefined();
    expect(memoryStorage.values.get('local:textduet.providerSettings')).not.toHaveProperty('apiKey');
    // The mock clears before surfacing the failure; a real Vault remains
    // encrypted and can be retried, but must never be restored as plaintext.
    expect(memoryStorage.values.get('local:textduet.providerSettings')).not.toHaveProperty('apiKeyByOrigin');
  });

  it('rejects stale Vault create and unlock operations across a clear boundary', async () => {
    const settings = await loadSettings();
    const token = settings.captureSecretLifecycleToken();
    await settings.clearVaultAndLegacySecrets();

    await expect(settings.createVaultAndMigrate('long-enough-password', token))
      .rejects.toBeInstanceOf(settings.SecretLifecycleClearedError);
    await expect(settings.unlockVaultAndMigrate('long-enough-password', token))
      .rejects.toBeInstanceOf(settings.SecretLifecycleClearedError);
    expect(vaultMock.createVault).not.toHaveBeenCalled();
    expect(vaultMock.unlockVault).not.toHaveBeenCalled();
  });

  it('serializes an in-flight key save ahead of a clear and leaves every store empty', async () => {
    const settings = await loadSettings();
    const originUrl = 'https://api.example.com/v1';
    vaultMock.getVaultStatus.mockResolvedValue({ exists: true, isUnlocked: true, version: 1 });
    memoryStorage.values.set('session:textduet.providerApiKeys', {
      'https://old.example.com': 'old-session-key',
    });
    memoryStorage.values.set('local:textduet.providerApiKey', 'legacy-local-key');

    let releaseSave!: () => void;
    let saveEntered!: () => void;
    const saveGate = new Promise<void>((resolve) => { releaseSave = resolve; });
    const saveStarted = new Promise<void>((resolve) => { saveEntered = resolve; });
    vaultMock.savePersistentApiKey.mockImplementationOnce(async (baseUrl: string, apiKey: string) => {
      saveEntered();
      await saveGate;
      const origin = new URL(baseUrl).origin;
      const normalized = apiKey.trim();
      if (normalized) vaultMock.persistentKeys.set(origin, normalized);
      else vaultMock.persistentKeys.delete(origin);
    });
    vaultMock.clearVault.mockImplementationOnce(async () => {
      vaultMock.persistentKeys.clear();
    });

    const savePromise = settings.saveApiKey('new-local-key', 'local', originUrl);
    await saveStarted;
    const clearPromise = settings.clearVaultAndLegacySecrets();

    // The clear operation must wait for the currently-owned lifecycle slot;
    // otherwise it can delete the Vault and let the paused save recreate a
    // credential after the clear has returned.
    await Promise.resolve();
    expect(vaultMock.clearVault).not.toHaveBeenCalled();

    releaseSave();
    const completion = Promise.allSettled([savePromise, clearPromise]);
    const results = await Promise.race([
      completion,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('lifecycle queue deadlocked')), 1_000)),
    ]);

    const saveResult = results[0];
    const clearResult = results[1];
    expect(saveResult.status).toBe('rejected');
    if (saveResult.status === 'rejected') {
      expect(saveResult.reason).toBeInstanceOf(settings.SecretLifecycleClearedError);
    }
    expect(clearResult.status).toBe('fulfilled');

    expect(memoryStorage.values.get('session:textduet.providerApiKeys')).toBeUndefined();
    expect(memoryStorage.values.get('session:textduet.providerApiKey')).toBeUndefined();
    expect(memoryStorage.values.get('local:textduet.providerApiKey')).toBeUndefined();
    expect(vaultMock.persistentKeys).toEqual(new Map());
    expect(vaultMock.clearVault).toHaveBeenCalledOnce();
  });

  it('invalidates a save paused in settings preflight before it can write a key', async () => {
    const settings = await loadSettings();
    const originUrl = 'https://api.example.com/v1';
    vaultMock.getVaultStatus.mockResolvedValue({ exists: true, isUnlocked: true, version: 1 });
    vaultMock.persistentKeys.set('https://api.example.com', 'old-local-key');
    memoryStorage.values.set('session:textduet.providerApiKeys', {
      'https://old.example.com': 'old-session-key',
    });
    memoryStorage.values.set('local:textduet.providerApiKey', 'legacy-local-key');
    memoryStorage.values.set('local:textduet.providerSettings', {
      provider: 'openai-compatible',
      baseUrl: originUrl,
      model: 'example-model',
      apiKeyPersistence: 'session',
      targetLanguage: 'zh-CN',
      displayMode: 'bilingual',
      customSystemPrompt: '',
      apiKey: 'legacy-settings-key',
    });
    vaultMock.clearVault.mockImplementationOnce(async () => {
      vaultMock.persistentKeys.clear();
    });

    // Prime migration before replacing the facade read so the gate only
    // represents background.saveProviderSettings's preflight read.
    await settings.migrateLegacySecrets();
    const originalGetValue = settings.providerSettingsStorage.getValue;
    let releaseRead!: () => void;
    let readStarted!: () => void;
    const readGate = new Promise<void>((resolve) => { releaseRead = resolve; });
    const readObserved = new Promise<void>((resolve) => { readStarted = resolve; });
    settings.providerSettingsStorage.getValue = async () => {
      readStarted();
      await readGate;
      return originalGetValue();
    };

    const lifecycleToken = settings.captureSecretLifecycleToken();
    const savePromise = (async () => {
      // This is the same await gap as background.saveProviderSettings.
      await settings.providerSettingsStorage.getValue();
      await settings.saveApiKey('late-key', 'session', originUrl, { lifecycleToken });
    })();
    await readObserved;

    // The clear must linearize and finish while the save is still paused.
    await Promise.race([
      settings.clearVaultAndLegacySecrets(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('clear blocked by preflight read')), 1_000)),
    ]);
    releaseRead();

    await expect(savePromise).rejects.toBeInstanceOf(settings.SecretLifecycleClearedError);
    expect(memoryStorage.values.get('session:textduet.providerApiKeys')).toBeUndefined();
    expect(memoryStorage.values.get('session:textduet.providerApiKey')).toBeUndefined();
    expect(memoryStorage.values.get('local:textduet.providerApiKey')).toBeUndefined();
    expect(memoryStorage.values.get('local:textduet.providerSettings')).not.toHaveProperty('apiKey');
    expect(vaultMock.persistentKeys).toEqual(new Map());
  });

  it('allows a new explicit save after the clear generation advances', async () => {
    const settings = await loadSettings();
    const originUrl = 'https://api.example.com/v1';
    vaultMock.getVaultStatus.mockResolvedValue({ exists: false, isUnlocked: false, version: null });
    vaultMock.clearVault.mockImplementationOnce(async () => {
      vaultMock.persistentKeys.clear();
    });

    await settings.clearVaultAndLegacySecrets();
    await expect(settings.saveApiKey('new-session-key', 'session', originUrl)).resolves.toBeUndefined();

    expect(memoryStorage.values.get('session:textduet.providerApiKeys')).toEqual({
      'https://api.example.com': 'new-session-key',
    });
  });

  it('commits redacted settings inside the lifecycle mutation without queue re-entry', async () => {
    const settings = await loadSettings();
    const committed = {
      provider: 'openai-compatible' as const,
      baseUrl: 'https://api.example.com/v1',
      model: 'example-model',
      models: ['example-model'],
      apiKeyPersistence: 'session' as const,
      targetLanguage: 'zh-CN',
      displayMode: 'bilingual' as const,
      customSystemPrompt: '',
      apiKey: 'must-not-persist',
      apiKeyByOrigin: { 'https://api.example.com': 'must-not-persist' },
    };

    await Promise.race([
      settings.saveApiKey('session-key', 'session', committed.baseUrl, { commitSettings: committed }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('settings commit deadlocked')), 1_000)),
    ]);

    const stored = memoryStorage.values.get('local:textduet.providerSettings') as Record<string, unknown>;
    expect(stored).not.toHaveProperty('apiKey');
    expect(stored).not.toHaveProperty('apiKeyByOrigin');
    expect(stored.model).toBe('example-model');
  });

  it('does not propagate unknown storage fields through the settings facade', async () => {
    memoryStorage.values.set('local:textduet.providerSettings', {
      provider: 'openai-compatible',
      baseUrl: 'https://api.example.com/v1',
      model: 'example-model',
      apiKeyPersistence: 'session',
      targetLanguage: 'zh-CN',
      displayMode: 'bilingual',
      customSystemPrompt: '',
      injectedMetadata: { oversized: 'untrusted' },
      apiKey: 'must-not-enter-memory',
    });
    const settings = await loadSettings();

    const publicValue = await settings.providerSettingsStorage.getValue();
    expect(publicValue).not.toHaveProperty('injectedMetadata');
    expect(publicValue).not.toHaveProperty('apiKey');

    await settings.providerSettingsStorage.setValue(publicValue);
    const stored = memoryStorage.values.get('local:textduet.providerSettings') as Record<string, unknown>;
    expect(stored).not.toHaveProperty('injectedMetadata');
    expect(stored).not.toHaveProperty('apiKey');
  });
});
