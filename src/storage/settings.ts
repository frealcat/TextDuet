import { storage } from '#imports';
import type { CostSettings, ProviderSettings } from '@/src/core/contracts';
import { DEFAULT_COST_SETTINGS, DEFAULT_PROVIDER_SETTINGS } from '@/src/core/defaults';
import { normalizeBaseUrlOrigin, type OriginApiKeyMap } from './provider-models';
import {
  clearPersistentApiKeys as clearPersistentVaultApiKeys,
  clearVault as clearVaultRaw,
  createVault as createVaultRaw,
  getPersistentApiKey as getPersistentVaultApiKey,
  getVaultStatus as getVaultStatusRaw,
  lockVault as lockVaultRaw,
  savePersistentApiKey as savePersistentVaultApiKey,
  restorePersistentApiKeys,
  snapshotPersistentApiKeys,
  unlockVault as unlockVaultRaw,
  VaultLockedError,
  type PersistentApiKeysSnapshot,
  type VaultStatus,
} from './vault';

const MAX_API_KEY_LENGTH = 4_096;
const MAX_ORIGIN_LENGTH = 2_048;

export interface LegacySecretMigrationResult {
  migratedPersistentKeyCount: number;
  migratedSessionKeyCount: number;
  discardedPersistentKeyCount: number;
  removedPlaintext: boolean;
}

/**
 * Opaque snapshot of the secret lifecycle. A destructive clear advances the
 * lifecycle, invalidating saves that started before the clear intent but have
 * not reached their first secret write yet.
 */
export interface SecretLifecycleToken {
  readonly generation: number;
}

/** Raised when a save crossed a destructive-clear boundary before writing. */
export class SecretLifecycleClearedError extends Error {
  constructor() {
    super('保险箱已清除，旧的保存操作已取消');
    this.name = 'SecretLifecycleClearedError';
  }
}

type LegacyProviderSettings = ProviderSettings & {
  apiKey?: unknown;
  apiKeyByOrigin?: unknown;
};

interface SessionKeySnapshot {
  keys: OriginApiKeyMap;
  legacyKey: string;
}

interface SecretStorageSnapshot {
  session: SessionKeySnapshot;
  persistent?: PersistentApiKeysSnapshot;
}

// Keep the public settings facade closed over the fields understood by the
// current schema. Storage is user-controlled input, so spreading a raw record
// here would let unknown metadata propagate into memory and future writes.
const PROVIDER_SETTING_KEYS = [
  'provider',
  'baseUrl',
  'model',
  'models',
  'modelByOrigin',
  'modelsByOrigin',
  'apiKeyPersistence',
  'targetLanguage',
  'sourceLanguage',
  'selectionQuickAction',
  'headerPopupRescan',
  'language',
  'displayMode',
  'translationColor',
  'customSystemPrompt',
] as const satisfies readonly (keyof ProviderSettings)[];

const rawProviderSettingsStorage = storage.defineItem<ProviderSettings>(
  'local:textduet.providerSettings',
  { fallback: DEFAULT_PROVIDER_SETTINGS },
);

/**
 * Public settings facade. Raw legacy secret fields are removed before every
 * write and are never returned to callers. The raw item remains private for
 * one-time migration cleanup only.
 */
export const providerSettingsStorage = {
  async getValue(): Promise<ProviderSettings> {
    await ensureLegacySecretMigration();
    return stripProviderSecrets(await rawProviderSettingsStorage.getValue());
  },
  async setValue(value: ProviderSettings, lifecycleToken?: SecretLifecycleToken): Promise<void> {
    await runSecretLifecycleMutation(async () => {
      assertSecretLifecycleToken(lifecycleToken);
      await ensureLegacySecretMigrationInMutation();
      assertSecretLifecycleToken(lifecycleToken);
      await setProviderSettingsRaw(value);
    });
  },
  watch(callback: Parameters<typeof rawProviderSettingsStorage.watch>[0]): ReturnType<typeof rawProviderSettingsStorage.watch> {
    return rawProviderSettingsStorage.watch((value, oldValue) => {
      callback(
        stripProviderSecrets(value as ProviderSettings),
        stripProviderSecrets(oldValue as ProviderSettings),
      );
    });
  },
};

export const costSettingsStorage = storage.defineItem<CostSettings>('local:textduet.costSettings', {
  fallback: DEFAULT_COST_SETTINGS,
});

// Legacy single-key slots. They are never used for new writes and are removed
// by migration and clear paths.
const legacyPersistentApiKeyStorage = storage.defineItem<string>('local:textduet.providerApiKey', {
  fallback: '',
});
const legacySessionApiKeyStorage = storage.defineItem<string>('session:textduet.providerApiKey', {
  fallback: '',
});
const sessionApiKeysStorage = storage.defineItem<OriginApiKeyMap>('session:textduet.providerApiKeys', {
  fallback: {},
});

let legacyMigrationCompleted = false;
let legacyMigrationResult: LegacySecretMigrationResult | undefined;
// Session storage and the encrypted Vault are separate browser stores, so
// their individual queues cannot make a multi-store lifecycle operation
// atomic. Keep one logical queue around every secret lifecycle mutation so a
// clear/create/unlock cannot be interleaved with a key move or migration.
let secretLifecycleMutation: Promise<void> = Promise.resolve();
let secretLifecycleGeneration = 0;

/** Captures the lifecycle generation for a save that may cross an await. */
export function captureSecretLifecycleToken(): SecretLifecycleToken {
  return Object.freeze({ generation: secretLifecycleGeneration });
}

function assertSecretLifecycleToken(token: SecretLifecycleToken | undefined): void {
  if (token && token.generation !== secretLifecycleGeneration) {
    throw new SecretLifecycleClearedError();
  }
}

/**
 * Advances the lifecycle synchronously at the clear call site. Keeping this
 * separate from the queued deletion makes the clear intent linearize before
 * cache cleanup or any other asynchronous preflight work.
 */
function invalidateSecretLifecycle(): void {
  secretLifecycleGeneration += 1;
}

/** Reads a session-only API key for the exact HTTPS origin of `baseUrl`. */
export async function getSessionApiKey(baseUrl: string): Promise<string> {
  await ensureLegacySecretMigration();
  return runSecretLifecycleMutation(() => getSessionApiKeyWithoutMigration(baseUrl));
}

/** Writes or clears a session-only per-origin API key. */
export async function saveSessionApiKey(baseUrl: string, apiKey: string): Promise<void> {
  const lifecycleToken = captureSecretLifecycleToken();
  assertSecretLifecycleToken(lifecycleToken);
  await runSecretLifecycleMutation(async () => {
    assertSecretLifecycleToken(lifecycleToken);
    await ensureLegacySecretMigrationInMutation();
    assertSecretLifecycleToken(lifecycleToken);
    await setSessionApiKeyWithoutMigration(baseUrl, apiKey);
  });
}

/** Removes all session-only keys, including the legacy single-key slot. */
export async function clearSessionApiKeys(): Promise<void> {
  invalidateSecretLifecycle();
  await runSecretLifecycleMutation(clearSessionApiKeysInternal);
}

/** Reads an encrypted persistent API key from the trusted vault. */
export async function getPersistentApiKey(baseUrl: string): Promise<string> {
  await ensureLegacySecretMigration();
  return runSecretLifecycleMutation(() => getPersistentVaultApiKey(baseUrl));
}

/** Stores an encrypted persistent API key and clears the matching session key. */
export async function savePersistentApiKey(baseUrl: string, apiKey: string): Promise<void> {
  const lifecycleToken = captureSecretLifecycleToken();
  assertSecretLifecycleToken(lifecycleToken);
  await runSecretLifecycleMutation(async () => {
    assertSecretLifecycleToken(lifecycleToken);
    await ensureLegacySecretMigrationInMutation();
    assertSecretLifecycleToken(lifecycleToken);
    const vaultStatus = await getVaultStatusRaw();
    assertSecretLifecycleToken(lifecycleToken);
    if (vaultStatus.exists && !vaultStatus.isUnlocked) throw new VaultLockedError();
    const snapshot = await captureSecretStorageSnapshot(
      vaultStatus.exists && vaultStatus.isUnlocked,
    );
    await withSecretStorageRollback(snapshot, async () => {
      assertSecretLifecycleToken(lifecycleToken);
      await savePersistentVaultApiKey(baseUrl, apiKey);
      await setSessionApiKeyWithoutMigration(baseUrl, '');
    });
  });
}

/** Removes every encrypted persistent API key while retaining the vault. */
export async function clearPersistentApiKeys(): Promise<void> {
  invalidateSecretLifecycle();
  await runSecretLifecycleMutation(clearPersistentVaultApiKeys);
}

/**
 * Resolves the active key without exposing storage details to Provider code.
 * Persistent-vault availability errors deliberately reach the caller: callers
 * need to distinguish a missing key from a vault that needs to be unlocked.
 */
export async function getApiKey(
  persistence: ProviderSettings['apiKeyPersistence'],
  baseUrl: string,
  // Compatibility parameter for callers compiled against the old per-origin
  // settings shape. It is intentionally ignored; plaintext maps are retired.
  _legacy?: { apiKeyByOrigin?: unknown },
): Promise<string> {
  await ensureLegacySecretMigration();
  return runSecretLifecycleMutation(() => persistence === 'session'
    ? getSessionApiKeyWithoutMigration(baseUrl)
    : getPersistentVaultApiKey(baseUrl));
}

/**
 * Saves a key according to the selected mode. Local persistence requires an
 * unlocked vault; switching modes clears the key from the other area.
 */
export async function saveApiKey(
  apiKey: string,
  persistence: ProviderSettings['apiKeyPersistence'],
  baseUrl: string,
  // Legacy options are accepted for source compatibility but never trusted.
  _legacy?: {
    apiKeyByOrigin?: OriginApiKeyMap;
    setLegacyGlobal?: boolean;
    modeChanged?: boolean;
    /** Redacted settings to commit while this lifecycle mutation is held. */
    commitSettings?: ProviderSettings;
    /** Commit non-secret settings only after the key mutation succeeds. */
    onCommitted?: () => Promise<void>;
    /** Lifecycle snapshot captured before an asynchronous settings read. */
    lifecycleToken?: SecretLifecycleToken;
  },
): Promise<void> {
  const lifecycleToken = _legacy?.lifecycleToken ?? captureSecretLifecycleToken();
  // Reject a save that was already stale before it even entered the queue.
  assertSecretLifecycleToken(lifecycleToken);
  const modeChanged = _legacy?.modeChanged === true;
  const settingsToCommit = _legacy?.commitSettings;
  const commitSettings = _legacy?.onCommitted;
  const commitSettingsInMutation = async (): Promise<void> => {
    if (settingsToCommit) {
      await setProviderSettingsRaw(settingsToCommit);
    } else {
      await commitSettings?.();
    }
  };
  await runSecretLifecycleMutation(async () => {
    assertSecretLifecycleToken(lifecycleToken);
    await ensureLegacySecretMigrationInMutation();
    assertSecretLifecycleToken(lifecycleToken);
    if (persistence === 'local') {
      const vaultStatus = await getVaultStatusRaw();
      assertSecretLifecycleToken(lifecycleToken);
      if (modeChanged && vaultStatus.exists && !vaultStatus.isUnlocked) throw new VaultLockedError();
      if (modeChanged) {
        // An empty field means "keep the existing key" in Options. When the
        // user only changes persistence mode, move the current-origin session
        // key into the Vault instead of treating the empty input as a clear;
        // if no source key exists, the empty value explicitly clears stale
        // destination data below.
        const normalizedKey = normalizeApiKey(apiKey) || await getSessionApiKeyWithoutMigration(baseUrl);
        const snapshot = await captureSecretStorageSnapshot(
          vaultStatus.exists && vaultStatus.isUnlocked,
        );
        await withSecretStorageRollback(snapshot, async () => {
          assertSecretLifecycleToken(lifecycleToken);
          // Write the destination first. If either this write or the source
          // cleanup fails, restore both stores to their prior state. Always
          // touch the destination when a Vault exists, including an
          // empty value. An empty mode-switch field means "keep" only when a
          // source key is present; if the source is already missing, an
          // existing destination entry is stale and must be deleted.
          if (vaultStatus.exists || normalizedKey) {
            await savePersistentVaultApiKey(baseUrl, normalizedKey);
          }
          await clearSessionApiKeyWithoutMigration(baseUrl);
          await commitSettingsInMutation();
        });
        return;
      }
      const normalizedKey = normalizeApiKey(apiKey);
      const snapshot = await captureSecretStorageSnapshot(
        vaultStatus.exists && vaultStatus.isUnlocked,
      );
      await withSecretStorageRollback(snapshot, async () => {
        assertSecretLifecycleToken(lifecycleToken);
        await savePersistentVaultApiKey(baseUrl, normalizedKey);
        await clearSessionApiKeyWithoutMigration(baseUrl);
        await commitSettingsInMutation();
      });
      return;
    }

    const vaultStatus = await getVaultStatusRaw();
    assertSecretLifecycleToken(lifecycleToken);
    // Switching to session mode must not leave a usable persistent key behind.
    // A locked vault cannot be safely rewritten, so reject the transition
    // before changing the session slot and let the caller keep its settings.
    if (modeChanged && vaultStatus.exists && !vaultStatus.isUnlocked) {
      throw new VaultLockedError();
    }
    if (modeChanged) {
      // Read the old encrypted value before clearing the Vault. An empty API
      // key is the Options "unchanged" sentinel during a mode-only save.
      const normalizedKey = normalizeApiKey(apiKey) || (
        vaultStatus.exists ? await getPersistentVaultApiKey(baseUrl) : ''
      );
      const snapshot = await captureSecretStorageSnapshot(
        vaultStatus.exists && vaultStatus.isUnlocked,
      );
      await withSecretStorageRollback(snapshot, async () => {
        assertSecretLifecycleToken(lifecycleToken);
        await setSessionApiKeyWithoutMigration(baseUrl, normalizedKey);
        if (vaultStatus.exists) await savePersistentVaultApiKey(baseUrl, '');
        await commitSettingsInMutation();
      });
      return;
    }
    const normalizedKey = normalizeApiKey(apiKey);
    const shouldClearPersistent = vaultStatus.exists && vaultStatus.isUnlocked;
    const snapshot = await captureSecretStorageSnapshot(shouldClearPersistent);
    await withSecretStorageRollback(snapshot, async () => {
      assertSecretLifecycleToken(lifecycleToken);
      await setSessionApiKeyWithoutMigration(baseUrl, normalizedKey);
      if (shouldClearPersistent) await savePersistentVaultApiKey(baseUrl, '');
      await commitSettingsInMutation();
    });
  });
}

/** Clears keys from current and all legacy locations. */
export async function clearApiKeys(): Promise<void> {
  invalidateSecretLifecycle();
  await runSecretLifecycleMutation(async () => {
    await ensureLegacySecretMigrationInMutation();
    const status = await getVaultStatusRaw();
    // Remove every plaintext slot first. This operation is intentionally
    // non-transactional: restoring a raw settings snapshot after a later
    // Vault failure would reintroduce credentials in cleartext. If the Vault
    // is locked or its clear fails, the encrypted copy remains retryable while
    // all legacy/session plaintext is already gone.
    await clearLegacySecretStorageInternal();
    if (status.exists) {
      if (!status.isUnlocked) throw new VaultLockedError();
      await clearPersistentVaultApiKeys();
    }
  });
}

/**
 * Removes every non-vault secret location. This is used immediately before
 * deleting the Vault so a failed/partial legacy migration cannot leave a
 * plaintext key behind. It intentionally does not require the Vault to be
 * unlocked because the caller is performing an explicit destructive reset.
 */
export async function clearLegacySecretStorage(): Promise<void> {
  invalidateSecretLifecycle();
  await runSecretLifecycleMutation(clearLegacySecretStorageInternal);
}

/**
 * Deletes every key location and the encrypted Vault as one logical
 * lifecycle operation. Legacy plaintext is removed first; if that phase
 * fails, the Vault is deliberately retained so a retry cannot strand an
 * encrypted recovery copy while restoring plaintext. The first error is
 * surfaced to the caller and a later retry is idempotent.
 */
export function clearVaultAndLegacySecrets(): Promise<void> {
  invalidateSecretLifecycle();
  return runSecretLifecycleMutation(async () => {
    // Keep this sequence deliberate. If legacy cleanup fails, deleting the
    // Vault first would make its rollback restore plaintext keys with no
    // encrypted destination left. Once legacy cleanup commits, a Vault delete
    // failure leaves only encrypted data and is safe to retry.
    await clearLegacySecretStorageInternal();
    await clearVaultStorage();
  });
}

/** Creates a vault and migrates any still-present legacy data. */
export async function createVaultAndMigrate(
  password: string,
  lifecycleToken?: SecretLifecycleToken,
): Promise<{
  status: VaultStatus;
  migration: LegacySecretMigrationResult;
}> {
  const effectiveLifecycleToken = lifecycleToken ?? captureSecretLifecycleToken();
  assertSecretLifecycleToken(effectiveLifecycleToken);
  return runSecretLifecycleMutation(async () => {
    assertSecretLifecycleToken(effectiveLifecycleToken);
    const status = await createVaultStorage(password);
    assertSecretLifecycleToken(effectiveLifecycleToken);
    const migration = await ensureLegacySecretMigrationInMutation();
    assertSecretLifecycleToken(effectiveLifecycleToken);
    return { status, migration };
  });
}

/** Unlocks a vault and retries migration of legacy data. */
export async function unlockVaultAndMigrate(
  password: string,
  lifecycleToken?: SecretLifecycleToken,
): Promise<{
  status: VaultStatus;
  migration: LegacySecretMigrationResult;
}> {
  const effectiveLifecycleToken = lifecycleToken ?? captureSecretLifecycleToken();
  assertSecretLifecycleToken(effectiveLifecycleToken);
  return runSecretLifecycleMutation(async () => {
    assertSecretLifecycleToken(effectiveLifecycleToken);
    const status = await unlockVaultStorage(password);
    assertSecretLifecycleToken(effectiveLifecycleToken);
    const migration = await ensureLegacySecretMigrationInMutation();
    assertSecretLifecycleToken(effectiveLifecycleToken);
    return { status, migration };
  });
}

/**
 * One-time migration for TD-2026-WS3 plaintext fields and key slots. Session
 * data can migrate without a password. Local data is encrypted only when a
 * vault is unlocked; otherwise it is deleted and must be entered again.
 */
export async function migrateLegacySecrets(): Promise<LegacySecretMigrationResult> {
  return runSecretLifecycleMutation(ensureLegacySecretMigrationInMutation);
}

function ensureLegacySecretMigration(): Promise<LegacySecretMigrationResult> {
  if (legacyMigrationCompleted && legacyMigrationResult) {
    return Promise.resolve(legacyMigrationResult);
  }
  return runSecretLifecycleMutation(ensureLegacySecretMigrationInMutation);
}

/** Runs migration while already holding the lifecycle queue. */
async function ensureLegacySecretMigrationInMutation(): Promise<LegacySecretMigrationResult> {
  if (legacyMigrationCompleted && legacyMigrationResult) return legacyMigrationResult;
  const result = await performLegacySecretMigration();
  legacyMigrationResult = result;
  legacyMigrationCompleted = true;
  return result;
}

async function performLegacySecretMigration(): Promise<LegacySecretMigrationResult> {
  const rawSettings = await rawProviderSettingsStorage.getValue() as LegacyProviderSettings;
  const legacyPersistentKey = normalizeUnknownApiKey(await legacyPersistentApiKeyStorage.getValue());
  const legacySessionKey = normalizeUnknownApiKey(await legacySessionApiKeyStorage.getValue());
  const legacySettingsKeys = readLegacySettingsKeys(rawSettings);
  const activeOrigin = normalizeBaseUrlOrigin(rawSettings.baseUrl);

  let migratedPersistentKeyCount = 0;
  let migratedSessionKeyCount = 0;
  let discardedPersistentKeyCount = 0;
  let sessionMapChanged = false;
  const vaultStatus = await getVaultStatusRaw();
  const persistentKeys = new Map<string, string>();
  const sessionKeys = await readSessionApiKeyMap();
  if (rawSettings.apiKeyPersistence === 'local') {
    for (const [origin, key] of legacySettingsKeys) persistentKeys.set(origin, key);
  } else {
    for (const [origin, key] of legacySettingsKeys) {
      if (!sessionKeys[origin]) {
        sessionKeys[origin] = key;
        migratedSessionKeyCount += 1;
        sessionMapChanged = true;
      }
    }
  }
  if (legacyPersistentKey && activeOrigin) persistentKeys.set(activeOrigin, legacyPersistentKey);

  if (legacySessionKey && activeOrigin) {
    if (rawSettings.apiKeyPersistence === 'local') {
      // A local-mode profile must never retain the legacy session key in
      // plaintext session storage. Treat it as another persistent candidate;
      // the encrypted Vault branch below either migrates it or discards it.
      if (!persistentKeys.has(activeOrigin)) persistentKeys.set(activeOrigin, legacySessionKey);
    } else if (!sessionKeys[activeOrigin]) {
      sessionKeys[activeOrigin] = legacySessionKey;
      migratedSessionKeyCount += 1;
      sessionMapChanged = true;
    }
  }

  if (persistentKeys.size > 0) {
    if (vaultStatus.exists && vaultStatus.isUnlocked) {
      for (const [origin, key] of persistentKeys) {
        const existing = await getPersistentVaultApiKey(origin);
        if (!existing) {
          await savePersistentVaultApiKey(origin, key);
          migratedPersistentKeyCount += 1;
        }
      }
    } else {
      discardedPersistentKeyCount = persistentKeys.size;
    }
  }

  if (sessionMapChanged) {
    await writeSessionApiKeyMap(sessionKeys);
  }

  const hasLegacyFields = Object.hasOwn(rawSettings, 'apiKey') || Object.hasOwn(rawSettings, 'apiKeyByOrigin');
  const removedPlaintext = hasLegacyFields || Boolean(legacyPersistentKey) || Boolean(legacySessionKey);
  await Promise.all([
    legacyPersistentApiKeyStorage.removeValue({ removeMeta: true }),
    legacySessionApiKeyStorage.removeValue({ removeMeta: true }),
    hasLegacyFields ? rawProviderSettingsStorage.setValue(stripProviderSecrets(rawSettings)) : Promise.resolve(),
  ]);

  return {
    migratedPersistentKeyCount,
    migratedSessionKeyCount,
    discardedPersistentKeyCount,
    removedPlaintext,
  };
}

async function getSessionApiKeyWithoutMigration(baseUrl: string): Promise<string> {
  const origin = requireOrigin(baseUrl);
  return (await readSessionApiKeyMap())[origin] || '';
}

async function setSessionApiKeyWithoutMigration(baseUrl: string, apiKey: string): Promise<void> {
  const origin = requireOrigin(baseUrl);
  const normalizedKey = normalizeApiKey(apiKey);
  const keys = await readSessionApiKeyMap();
  if (normalizedKey) keys[origin] = normalizedKey;
  else delete keys[origin];
  await writeSessionApiKeyMap(keys);
}

async function clearSessionApiKeyWithoutMigration(baseUrl: string): Promise<void> {
  const origin = requireOrigin(baseUrl);
  const keys = await readSessionApiKeyMap();
  delete keys[origin];
  await writeSessionApiKeyMap(keys);
  // The legacy slot is global and cannot be associated with another origin;
  // it is retired after migration, so clearing it here is safe and prevents
  // an old reader from observing a stale credential.
  await legacySessionApiKeyStorage.removeValue({ removeMeta: true });
}

/** Removes every session-scoped key slot without entering either queue. */
async function clearSessionApiKeysInternal(): Promise<void> {
  await Promise.all([
    sessionApiKeysStorage.removeValue({ removeMeta: true }),
    legacySessionApiKeyStorage.removeValue({ removeMeta: true }),
  ]);
}

/** Removes all legacy plaintext locations without entering the lifecycle queue. */
async function clearLegacySecretStorageInternal(): Promise<void> {
  await Promise.all([
    clearSessionApiKeysInternal(),
    legacyPersistentApiKeyStorage.removeValue({ removeMeta: true }),
    removeLegacyFieldsFromProviderSettings(),
  ]);
}

// These aliases are deliberately queue-free. Public wrappers below provide
// the lifecycle boundary; nested calls from create/unlock/clear must not wait
// on the queue currently holding them.
async function clearVaultStorage(): Promise<void> {
  await clearVaultRaw();
}

function createVaultStorage(password: string): Promise<VaultStatus> {
  return createVaultRaw(password);
}

function unlockVaultStorage(password: string): Promise<VaultStatus> {
  return unlockVaultRaw(password);
}

function lockVaultStorage(): Promise<VaultStatus> {
  return lockVaultRaw();
}

async function captureSessionKeySnapshot(): Promise<SessionKeySnapshot> {
  return {
    keys: await readSessionApiKeyMap(),
    legacyKey: normalizeUnknownApiKey(await legacySessionApiKeyStorage.getValue()),
  };
}

async function restoreSessionKeySnapshot(snapshot: SessionKeySnapshot): Promise<void> {
  await Promise.all([
    writeSessionApiKeyMap(snapshot.keys),
    snapshot.legacyKey
      ? legacySessionApiKeyStorage.setValue(snapshot.legacyKey)
      : legacySessionApiKeyStorage.removeValue({ removeMeta: true }),
  ]);
}

async function captureSecretStorageSnapshot(
  includePersistent: boolean,
): Promise<SecretStorageSnapshot> {
  const session = await captureSessionKeySnapshot();
  if (!includePersistent) return { session };
  return {
    session,
    persistent: await snapshotPersistentApiKeys(),
  };
}

async function withSecretStorageRollback<T>(
  snapshot: SecretStorageSnapshot,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Restore both sides before surfacing the original failure. If recovery
    // itself fails, preserve the original error while making the failure
    // visible in diagnostics; callers must retry rather than assume success.
    const restoreResults = await Promise.allSettled([
      restoreSessionKeySnapshot(snapshot.session),
      snapshot.persistent
        ? restorePersistentApiKeys(snapshot.persistent)
        : Promise.resolve(),
    ]);
    if (restoreResults.some((result) => result.status === 'rejected')) {
      console.warn('[textduet] failed to roll back API key storage after a write error');
    }
    throw error;
  }
}

async function readSessionApiKeyMap(): Promise<OriginApiKeyMap> {
  return normalizeApiKeyMap(await sessionApiKeysStorage.getValue());
}

async function writeSessionApiKeyMap(value: OriginApiKeyMap): Promise<void> {
  const normalized = normalizeApiKeyMap(value);
  if (Object.keys(normalized).length === 0) await sessionApiKeysStorage.removeValue({ removeMeta: true });
  else await sessionApiKeysStorage.setValue(normalized);
}

function readLegacySettingsKeys(settings: LegacyProviderSettings): Map<string, string> {
  const result = new Map<string, string>();
  if (isRecord(settings.apiKeyByOrigin)) {
    for (const [origin, key] of Object.entries(settings.apiKeyByOrigin)) {
      const normalized = normalizeUnknownApiKey(key);
      if (isOrigin(origin) && normalized) result.set(origin, normalized);
    }
  }
  const activeOrigin = normalizeBaseUrlOrigin(settings.baseUrl);
  const activeKey = normalizeUnknownApiKey(settings.apiKey);
  if (activeOrigin && activeKey && !result.has(activeOrigin)) result.set(activeOrigin, activeKey);
  return result;
}

async function removeLegacyFieldsFromProviderSettings(): Promise<void> {
  const raw = await rawProviderSettingsStorage.getValue() as LegacyProviderSettings;
  if (Object.hasOwn(raw, 'apiKey') || Object.hasOwn(raw, 'apiKeyByOrigin')) {
    await rawProviderSettingsStorage.setValue(stripProviderSecrets(raw));
  }
}

/**
 * Writes the redacted settings record for a mutation that already owns the
 * lifecycle queue. Callers must not use this to persist secret fields.
 */
async function setProviderSettingsRaw(value: ProviderSettings): Promise<void> {
  await rawProviderSettingsStorage.setValue(stripProviderSecrets(value));
}

function stripProviderSecrets(value: ProviderSettings | null | undefined): ProviderSettings {
  // A storage remove/watch event may provide `undefined`; keep the public
  // facade total instead of attempting to destructure a missing record.
  if (!isRecord(value)) return DEFAULT_PROVIDER_SETTINGS;
  const settings: Record<string, unknown> = {};
  for (const key of PROVIDER_SETTING_KEYS) {
    if (Object.hasOwn(value, key)) settings[key] = value[key];
  }
  return {
    ...DEFAULT_PROVIDER_SETTINGS,
    ...settings,
  } as ProviderSettings;
}

function normalizeApiKeyMap(value: unknown): OriginApiKeyMap {
  if (!isRecord(value)) return {};
  const result: OriginApiKeyMap = {};
  for (const [origin, apiKey] of Object.entries(value)) {
    const normalized = normalizeUnknownApiKey(apiKey);
    if (isOrigin(origin) && normalized) result[origin] = normalized;
  }
  return result;
}

function normalizeUnknownApiKey(value: unknown): string {
  if (typeof value !== 'string') return '';
  try {
    return normalizeApiKey(value);
  } catch {
    return '';
  }
}

function normalizeApiKey(value: string): string {
  const normalized = value.trim();
  if (normalized.length > MAX_API_KEY_LENGTH) throw new Error('API Key 长度无效');
  return normalized;
}

function requireOrigin(baseUrl: string): string {
  const origin = normalizeBaseUrlOrigin(baseUrl);
  if (!origin || origin.length > MAX_ORIGIN_LENGTH) throw new Error('API 地址必须是有效的 HTTPS URL');
  return origin;
}

function isOrigin(value: string): boolean {
  return value.length <= MAX_ORIGIN_LENGTH && normalizeBaseUrlOrigin(value) === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Serializes all cross-store secret lifecycle mutations. */
function runSecretLifecycleMutation<T>(operation: () => Promise<T>): Promise<T> {
  const next = secretLifecycleMutation.then(operation, operation);
  secretLifecycleMutation = next.then(() => undefined, () => undefined);
  return next;
}

/** Queued Vault lifecycle wrappers for trusted Service Worker callers. */
export async function createVault(
  password: string,
  lifecycleToken?: SecretLifecycleToken,
): Promise<VaultStatus> {
  const effectiveLifecycleToken = lifecycleToken ?? captureSecretLifecycleToken();
  assertSecretLifecycleToken(effectiveLifecycleToken);
  return runSecretLifecycleMutation(async () => {
    assertSecretLifecycleToken(effectiveLifecycleToken);
    const status = await createVaultStorage(password);
    assertSecretLifecycleToken(effectiveLifecycleToken);
    return status;
  });
}

export async function unlockVault(
  password: string,
  lifecycleToken?: SecretLifecycleToken,
): Promise<VaultStatus> {
  const effectiveLifecycleToken = lifecycleToken ?? captureSecretLifecycleToken();
  assertSecretLifecycleToken(effectiveLifecycleToken);
  return runSecretLifecycleMutation(async () => {
    assertSecretLifecycleToken(effectiveLifecycleToken);
    const status = await unlockVaultStorage(password);
    assertSecretLifecycleToken(effectiveLifecycleToken);
    return status;
  });
}

export async function lockVault(lifecycleToken?: SecretLifecycleToken): Promise<VaultStatus> {
  const effectiveLifecycleToken = lifecycleToken ?? captureSecretLifecycleToken();
  assertSecretLifecycleToken(effectiveLifecycleToken);
  return runSecretLifecycleMutation(async () => {
    assertSecretLifecycleToken(effectiveLifecycleToken);
    const status = await lockVaultStorage();
    assertSecretLifecycleToken(effectiveLifecycleToken);
    return status;
  });
}

export async function clearVault(): Promise<void> {
  invalidateSecretLifecycle();
  return runSecretLifecycleMutation(clearVaultStorage);
}

/** Reads the redacted Vault status without exposing encrypted contents. */
export function getVaultStatus(): Promise<VaultStatus> {
  return getVaultStatusRaw();
}
