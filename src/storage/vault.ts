/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import { storage } from '#imports';
import { normalizeBaseUrlOrigin } from './provider-models';

const VAULT_VERSION = 1;
const VAULT_PAYLOAD_VERSION = 1;
const VAULT_KEY_BYTES = 32;
const VAULT_SALT_BYTES = 16;
const VAULT_IV_BYTES = 12;
const PBKDF2_ITERATIONS = 600_000;
const MAX_API_KEY_LENGTH = 4_096;
const MAX_ORIGIN_LENGTH = 2_048;
const MAX_ENCRYPTED_VALUE_BYTES = 60 * 1024 * 1024;

const ROOT_AAD_PREFIX = 'textduet.vault.root';
const VALUE_AAD_PREFIX = 'textduet.vault.value';

export interface VaultCiphertext {
  version: 1;
  iv: string;
  ciphertext: string;
}

export interface VaultEnvelope {
  version: 1;
  vaultId: string;
  kdf: {
    name: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    salt: string;
  };
  payload: VaultCiphertext;
}

interface VaultPayload {
  version: 1;
  providerApiKeys: Record<string, string>;
}

interface VaultUnlockMaterial {
  vaultId: string;
  key: string;
}

export interface VaultStatus {
  exists: boolean;
  isUnlocked: boolean;
  version: number | null;
}

/**
 * Trusted-context snapshot used when a settings update spans the Vault and
 * `storage.session`. It never crosses a runtime-message boundary.
 */
export interface PersistentApiKeysSnapshot {
  providerApiKeys: Readonly<Record<string, string>>;
}

/** A safe error for callers to turn into a generic unlock prompt. */
export class VaultLockedError extends Error {
  constructor() {
    super('保险箱已锁定，请先解锁后再访问持久化密钥');
    this.name = 'VaultLockedError';
  }
}

/** The user must create a password-protected vault before persistent storage. */
export class VaultNotInitializedError extends Error {
  constructor() {
    super('尚未创建本地保险箱');
    this.name = 'VaultNotInitializedError';
  }
}

/** A password did not authenticate the stored encrypted payload. */
export class VaultInvalidPasswordError extends Error {
  constructor() {
    super('保险箱密码不正确');
    this.name = 'VaultInvalidPasswordError';
  }
}

/** The stored envelope was malformed or cannot be safely decoded. */
export class VaultCorruptError extends Error {
  constructor() {
    super('本地保险箱数据损坏，无法安全读取');
    this.name = 'VaultCorruptError';
  }
}

class VaultAuthenticationFailure extends Error {
  constructor() {
    super('保险箱认证失败');
    this.name = 'VaultAuthenticationFailure';
  }
}

export const vaultStorage = storage.defineItem<VaultEnvelope | null>('local:textduet.vault', {
  fallback: null,
});

// `storage.session` is restricted to trusted extension contexts at Service
// Worker startup. It contains a derived AES key, never the user password, and
// is discarded when the browser session ends.
const vaultUnlockStorage = storage.defineItem<VaultUnlockMaterial | null>(
  'session:textduet.vault.unlock',
  { fallback: null },
);

let vaultMutation: Promise<void> = Promise.resolve();

/**
 * Creates an empty vault and leaves it unlocked for the current browser
 * session. A vault cannot be overwritten accidentally; callers must use
 * `clearVault` after an explicit destructive confirmation.
 */
export async function createVault(password: string): Promise<VaultStatus> {
  return runVaultMutation(async () => {
    assertPassword(password);
    const existing = await vaultStorage.getValue();
    if (existing) {
      throw new Error('本地保险箱已存在；请先解锁或明确删除现有保险箱');
    }

    const salt = randomBytes(VAULT_SALT_BYTES);
    const vaultId = bytesToBase64(randomBytes(VAULT_SALT_BYTES));
    const key = await deriveVaultKey(password, salt);
    const payload = emptyVaultPayload();
    const envelope: VaultEnvelope = {
      version: VAULT_VERSION,
      vaultId,
      kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: PBKDF2_ITERATIONS,
        salt: bytesToBase64(salt),
      },
      payload: await encryptBytes(key, encodeJson(payload), rootAad(vaultId)),
    };

    await vaultStorage.setValue(envelope);
    try {
      await saveUnlockMaterial(vaultId, key);
    } catch (error) {
      // Avoid leaving an apparently-created but unusable envelope when the
      // session unlock material cannot be written. Cleanup is best effort;
      // if it fails, the encrypted envelope remains locked and retryable.
      await vaultStorage.removeValue({ removeMeta: true }).catch(() => undefined);
      throw error;
    }
    return { exists: true, isUnlocked: true, version: VAULT_VERSION };
  });
}

/**
 * Validates a password by decrypting the authenticated root payload, then
 * stores only its derived AES key in restricted session storage.
 */
export async function unlockVault(password: string): Promise<VaultStatus> {
  return runVaultMutation(async () => {
    assertPassword(password);
    const envelope = parseVaultEnvelope(await vaultStorage.getValue());
    if (!envelope) throw new VaultNotInitializedError();

    let key: CryptoKey;
    try {
      key = await deriveVaultKey(password, base64ToBytes(envelope.kdf.salt));
      parseVaultPayload(await decryptBytes(key, envelope.payload, rootAad(envelope.vaultId)));
    } catch (error) {
      if (error instanceof VaultCorruptError) throw error;
      throw new VaultInvalidPasswordError();
    }

    try {
      await saveUnlockMaterial(envelope.vaultId, key);
    } catch (error) {
      // A failed write must not leave a previous session key looking like the
      // result of this unlock attempt. Fail closed: keep the encrypted Vault
      // intact, clear any stale unlock material when possible, and require a
      // successful retry before trusted callers may use persistent data.
      await vaultUnlockStorage.removeValue({ removeMeta: true }).catch(() => undefined);
      throw error;
    }
    return { exists: true, isUnlocked: true, version: envelope.version };
  });
}

/** Removes only ephemeral unlock material. The encrypted vault remains intact. */
export async function lockVault(): Promise<VaultStatus> {
  return runVaultMutation(async () => {
    await vaultUnlockStorage.removeValue();
    const envelope = parseVaultEnvelope(await vaultStorage.getValue());
    return { exists: Boolean(envelope), isUnlocked: false, version: envelope?.version ?? null };
  });
}

/** Explicitly and irreversibly removes encrypted root data and unlock material. */
export async function clearVault(): Promise<void> {
  await runVaultMutation(async () => {
    // Remove ephemeral unlock material first. If this fails, retain the
    // encrypted envelope and let the caller retry; deleting in parallel could
    // otherwise lose the only recoverable copy before reporting failure.
    await vaultUnlockStorage.removeValue({ removeMeta: true });
    await vaultStorage.removeValue({ removeMeta: true });
  });
}

/** Returns a redacted status only; it never reveals password or decrypted data. */
export async function getVaultStatus(): Promise<VaultStatus> {
  const envelope = parseVaultEnvelope(await vaultStorage.getValue());
  if (!envelope) return { exists: false, isUnlocked: false, version: null };

  const unlock = await vaultUnlockStorage.getValue();
  return {
    exists: true,
    isUnlocked: Boolean(unlock && unlock.vaultId === envelope.vaultId && isValidSessionKey(unlock.key)),
    version: envelope.version,
  };
}

/** Reads one persistent API key. This trusted-context API throws while locked. */
export async function getPersistentApiKey(baseUrl: string): Promise<string> {
  const origin = requireOrigin(baseUrl);
  const payload = await readUnlockedVaultPayload();
  return payload.providerApiKeys[origin] || '';
}

/**
 * Stores one persistent API key in the encrypted root payload. Empty values
 * remove the origin entry, which lets callers use the same operation for an
 * explicit key clear.
 */
export async function savePersistentApiKey(baseUrl: string, apiKey: string): Promise<void> {
  const origin = requireOrigin(baseUrl);
  const key = normalizeApiKey(apiKey);
  await updateUnlockedVaultPayload((payload) => {
    if (key) payload.providerApiKeys[origin] = key;
    else delete payload.providerApiKeys[origin];
  });
}

/** Removes all encrypted persistent API keys but retains other future vault data. */
export async function clearPersistentApiKeys(): Promise<void> {
  await updateUnlockedVaultPayload((payload) => {
    payload.providerApiKeys = {};
  });
}

/**
 * Captures all encrypted provider keys for a best-effort cross-storage
 * rollback. The returned object is a defensive copy and contains plaintext
 * only in the trusted Service Worker memory for the duration of a mutation.
 */
export async function snapshotPersistentApiKeys(): Promise<PersistentApiKeysSnapshot> {
  return runVaultMutation(async () => {
    const payload = await readUnlockedVaultPayload();
    return { providerApiKeys: { ...payload.providerApiKeys } };
  });
}

/**
 * Restores a snapshot through the Vault mutation queue. Settings code uses
 * this only after a later `storage.session` phase fails, so a failed restore
 * remains observable to the caller instead of silently claiming success.
 */
export async function restorePersistentApiKeys(
  snapshot: PersistentApiKeysSnapshot,
): Promise<void> {
  const providerApiKeys = normalizeVaultPayload({
    version: VAULT_PAYLOAD_VERSION,
    providerApiKeys: snapshot.providerApiKeys,
  }).providerApiKeys;
  await updateUnlockedVaultPayload((payload) => {
    payload.providerApiKeys = { ...providerApiKeys };
  });
}

/**
 * Encrypts an opaque value for a trusted Service Worker subsystem (for
 * example the persistent translation cache). The `purpose` is authenticated
 * as AES-GCM additional data, so ciphertext cannot be replayed as a
 * differently-scoped value.
 */
export async function encryptWithVault(
  value: Uint8Array,
  purpose: string,
): Promise<VaultCiphertext> {
  const key = await getUnlockedVaultKey();
  return encryptBytes(key, value, valueAad(purpose));
}

/** Decrypts an opaque trusted-context value previously encrypted by this vault. */
export async function decryptWithVault(
  value: VaultCiphertext,
  purpose: string,
): Promise<Uint8Array> {
  const key = await getUnlockedVaultKey();
  return decryptBytes(key, parseVaultCiphertext(value), valueAad(purpose));
}

async function readUnlockedVaultPayload(): Promise<VaultPayload> {
  const envelope = parseVaultEnvelope(await vaultStorage.getValue());
  if (!envelope) throw new VaultNotInitializedError();
  const key = await getUnlockedVaultKey(envelope);
  try {
    return parseVaultPayload(await decryptBytes(key, envelope.payload, rootAad(envelope.vaultId)));
  } catch (error) {
    if (error instanceof VaultCorruptError) throw error;
    throw new VaultCorruptError();
  }
}

async function updateUnlockedVaultPayload(
  mutate: (payload: VaultPayload) => void,
): Promise<void> {
  await runVaultMutation(async () => {
    const envelope = parseVaultEnvelope(await vaultStorage.getValue());
    if (!envelope) throw new VaultNotInitializedError();
    const key = await getUnlockedVaultKey(envelope);
    const payload = await readUnlockedVaultPayload();
    mutate(payload);
    const nextPayload = normalizeVaultPayload(payload);
    await vaultStorage.setValue({
      ...envelope,
      payload: await encryptBytes(key, encodeJson(nextPayload), rootAad(envelope.vaultId)),
    });
  });
}

async function getUnlockedVaultKey(expectedEnvelope?: VaultEnvelope): Promise<CryptoKey> {
  const envelope = expectedEnvelope ?? parseVaultEnvelope(await vaultStorage.getValue());
  if (!envelope) throw new VaultNotInitializedError();
  const unlock = await vaultUnlockStorage.getValue();
  if (!unlock || unlock.vaultId !== envelope.vaultId || !isValidSessionKey(unlock.key)) {
    throw new VaultLockedError();
  }
  try {
    return await crypto.subtle.importKey(
      'raw',
      toArrayBuffer(base64ToBytes(unlock.key)),
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    );
  } catch {
    await vaultUnlockStorage.removeValue();
    throw new VaultLockedError();
  }
}

async function saveUnlockMaterial(vaultId: string, key: CryptoKey): Promise<void> {
  const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key));
  await vaultUnlockStorage.setValue({ vaultId, key: bytesToBase64(rawKey) });
}

async function deriveVaultKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const passwordMaterial = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(new TextEncoder().encode(password)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordMaterial,
    { name: 'AES-GCM', length: 256 },
    // The key is exportable only long enough to place it in restricted
    // `storage.session`; the user password itself is never persisted.
    true,
    ['encrypt', 'decrypt'],
  );
}

async function encryptBytes(
  key: CryptoKey,
  value: Uint8Array,
  additionalData: Uint8Array,
): Promise<VaultCiphertext> {
  const iv = randomBytes(VAULT_IV_BYTES);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv), additionalData: toArrayBuffer(additionalData) },
    key,
    toArrayBuffer(value),
  ));
  return { version: VAULT_VERSION, iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext) };
}

async function decryptBytes(
  key: CryptoKey,
  value: VaultCiphertext,
  additionalData: Uint8Array,
): Promise<Uint8Array> {
  const ciphertext = base64ToBytes(value.ciphertext);
  if (ciphertext.byteLength > MAX_ENCRYPTED_VALUE_BYTES) throw new VaultCorruptError();
  try {
    return new Uint8Array(await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(base64ToBytes(value.iv)),
        additionalData: toArrayBuffer(additionalData),
      },
      key,
      toArrayBuffer(ciphertext),
    ));
  } catch {
    throw new VaultAuthenticationFailure();
  }
}

function parseVaultEnvelope(value: unknown): VaultEnvelope | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || value.version !== VAULT_VERSION || typeof value.vaultId !== 'string') {
    throw new VaultCorruptError();
  }
  if (!isSafeBase64(value.vaultId, 64)) throw new VaultCorruptError();
  if (!isRecord(value.kdf) || value.kdf.name !== 'PBKDF2' || value.kdf.hash !== 'SHA-256'
    || value.kdf.iterations !== PBKDF2_ITERATIONS || typeof value.kdf.salt !== 'string'
    || !isSafeBase64(value.kdf.salt, 128)) {
    throw new VaultCorruptError();
  }
  const salt = base64ToBytes(value.kdf.salt);
  if (salt.byteLength !== VAULT_SALT_BYTES) throw new VaultCorruptError();
  return {
    version: VAULT_VERSION,
    vaultId: value.vaultId,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: value.kdf.salt,
    },
    payload: parseVaultCiphertext(value.payload),
  };
}

function parseVaultCiphertext(value: unknown): VaultCiphertext {
  if (!isRecord(value) || value.version !== VAULT_VERSION || typeof value.iv !== 'string'
    || typeof value.ciphertext !== 'string' || !isSafeBase64(value.iv, 64)
    || !isSafeBase64(value.ciphertext, MAX_ENCRYPTED_VALUE_BYTES * 2)) {
    throw new VaultCorruptError();
  }
  const iv = base64ToBytes(value.iv);
  if (iv.byteLength !== VAULT_IV_BYTES) throw new VaultCorruptError();
  return { version: VAULT_VERSION, iv: value.iv, ciphertext: value.ciphertext };
}

function parseVaultPayload(value: Uint8Array): VaultPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(value));
  } catch {
    throw new VaultCorruptError();
  }
  return normalizeVaultPayload(parsed);
}

function normalizeVaultPayload(value: unknown): VaultPayload {
  if (!isRecord(value) || value.version !== VAULT_PAYLOAD_VERSION || !isRecord(value.providerApiKeys)) {
    throw new VaultCorruptError();
  }
  const providerApiKeys: Record<string, string> = {};
  for (const [origin, key] of Object.entries(value.providerApiKeys)) {
    if (!isOrigin(origin) || typeof key !== 'string') throw new VaultCorruptError();
    const normalized = normalizeApiKey(key);
    if (!normalized) continue;
    providerApiKeys[origin] = normalized;
  }
  return { version: VAULT_PAYLOAD_VERSION, providerApiKeys };
}

function emptyVaultPayload(): VaultPayload {
  return { version: VAULT_PAYLOAD_VERSION, providerApiKeys: {} };
}

function assertPassword(password: string): void {
  if (typeof password !== 'string' || password.length < 8 || password.length > 1_024) {
    throw new Error('保险箱密码长度必须在 8 到 1024 个字符之间');
  }
}

function normalizeApiKey(value: string): string {
  const normalized = value.trim();
  if (normalized.length > MAX_API_KEY_LENGTH) {
    throw new Error('API Key 长度无效');
  }
  return normalized;
}

function requireOrigin(baseUrl: string): string {
  const origin = normalizeBaseUrlOrigin(baseUrl);
  if (!origin || origin.length > MAX_ORIGIN_LENGTH) {
    throw new Error('API 地址必须是有效的 HTTPS URL');
  }
  return origin;
}

function isOrigin(value: string): boolean {
  return value.length <= MAX_ORIGIN_LENGTH && normalizeBaseUrlOrigin(value) === value;
}

function rootAad(vaultId: string): Uint8Array {
  return new TextEncoder().encode(`${ROOT_AAD_PREFIX}:${VAULT_VERSION}:${vaultId}`);
}

function valueAad(purpose: string): Uint8Array {
  if (!/^[a-z0-9-]{1,96}$/.test(purpose)) {
    throw new Error('保险箱加密用途无效');
  }
  return new TextEncoder().encode(`${VALUE_AAD_PREFIX}:${VAULT_VERSION}:${purpose}`);
}

function encodeJson(value: VaultPayload): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer as ArrayBuffer;
}

function bytesToBase64(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    throw new VaultCorruptError();
  }
}

function isSafeBase64(value: string, maxLength: number): boolean {
  return value.length > 0 && value.length <= maxLength && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

function isValidSessionKey(value: string): boolean {
  if (!isSafeBase64(value, 128)) return false;
  try {
    return base64ToBytes(value).byteLength === VAULT_KEY_BYTES;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function runVaultMutation<T>(operation: () => Promise<T>): Promise<T> {
  const next = vaultMutation.then(operation, operation);
  vaultMutation = next.then(() => undefined, () => undefined);
  return next;
}

export const __VAULT_INTERNAL = {
  PBKDF2_ITERATIONS,
  VAULT_VERSION,
  parseVaultEnvelope,
  parseVaultPayload,
};
