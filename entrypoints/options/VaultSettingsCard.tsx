/*
 * SPDX-FileCopyrightText: Copyright 2026 frealcat
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { DatabaseIcon, ShieldCheckIcon, SpinnerIcon, TrashIcon } from '@/src/icons';
import type { RuntimeMessage, VaultStatus } from '@/src/core/contracts';
import {
  parseOperationResult,
  parseVaultStatus,
} from '@/src/core/schemas';
import { useTranslation } from '@/src/i18n';

interface VaultSettingsCardProps {
  id?: string;
}

/** Controls the encrypted vault without ever displaying or returning a key. */
export function VaultSettingsCard({ id }: VaultSettingsCardProps = {}) {
  const { t } = useTranslation();
  const [status, setVaultStatus] = useState<VaultStatus | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function refreshStatus(): Promise<void> {
    try {
      const value: unknown = await browser.runtime.sendMessage({ type: 'GET_VAULT_STATUS' } satisfies RuntimeMessage);
      setVaultStatus(parseVaultStatus(value));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('vault.status.failed'));
    }
  }

  function clearPasswordFields(): void {
    setPassword('');
    setConfirmation('');
  }

  async function mutate(type: 'CREATE_VAULT' | 'UNLOCK_VAULT'): Promise<void> {
    if (!password) {
      setMessage(t('vault.status.passwordRequired'));
      return;
    }
    if (type === 'CREATE_VAULT' && password !== confirmation) {
      setMessage(t('vault.status.passwordMismatch'));
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const value: unknown = await browser.runtime.sendMessage({ type, password } satisfies RuntimeMessage);
      setVaultStatus(parseVaultStatus(value));
      setMessage(type === 'CREATE_VAULT' ? t('vault.status.created') : t('vault.status.unlocked'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('vault.status.failed'));
    } finally {
      clearPasswordFields();
      setBusy(false);
    }
  }

  async function lock(): Promise<void> {
    setBusy(true);
    setMessage('');
    try {
      const value: unknown = await browser.runtime.sendMessage({ type: 'LOCK_VAULT' } satisfies RuntimeMessage);
      setVaultStatus(parseVaultStatus(value));
      setMessage(t('vault.status.locked'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('vault.status.failed'));
    } finally {
      setBusy(false);
    }
  }

  async function clearVault(): Promise<void> {
    if (!window.confirm(t('vault.confirm.delete'))) return;
    setBusy(true);
    setMessage('');
    try {
      const value: unknown = await browser.runtime.sendMessage({ type: 'CLEAR_VAULT' } satisfies RuntimeMessage);
      setVaultStatus(parseVaultStatus(value));
      setMessage(t('vault.status.deleted'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('vault.status.failed'));
    } finally {
      clearPasswordFields();
      setBusy(false);
    }
  }

  async function clearCacheAndKeys(): Promise<void> {
    if (!window.confirm(t('vault.confirm.clearCache'))) return;
    setBusy(true);
    setMessage('');
    try {
      const rawResult: unknown = await browser.runtime.sendMessage({ type: 'CLEAR_TRANSLATION_CACHE' } satisfies RuntimeMessage);
      const result = parseOperationResult(rawResult);
      if (!result.ok) throw new Error(result.message || t('vault.status.failed'));
      setMessage(t('vault.status.cacheCleared'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('vault.status.failed'));
    } finally {
      setBusy(false);
    }
  }

  const stateLabel = status === null
    ? t('vault.state.notCreated')
    : !status.exists
      ? t('vault.state.notCreated')
      : status.isUnlocked
        ? t('vault.state.unlocked')
        : t('vault.state.locked');
  const canCreate = status !== null && !status.exists;
  const canUnlock = status?.exists === true && !status.isUnlocked;
  const canLock = status?.exists === true && status.isUnlocked;

  return (
    <section id={id} className="settings-card vault-card" aria-labelledby="vault-heading">
      <div className="section-heading">
        <div>
          <span className="step">09</span>
          <h2 id="vault-heading">{t('vault.section.title')}</h2>
        </div>
        <span className="badge">
          <ShieldCheckIcon size={12} />
          {t('vault.section.badge')}
        </span>
      </div>

      <p className="cost-disclaimer">{t('vault.hint')}</p>
      <div className="vault-status" aria-live="polite">
        <DatabaseIcon size={16} aria-hidden="true" />
        <strong>{stateLabel}</strong>
      </div>

      {(canCreate || canUnlock) && (
        <div className="vault-form">
          <label>
            <span>{canCreate ? t('vault.password.createLabel') : t('vault.password.unlockLabel')}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('vault.password.placeholder')}
              autoComplete="new-password"
              disabled={busy}
            />
          </label>
          {canCreate && (
            <label>
              <span>{t('vault.password.confirmLabel')}</span>
              <input
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={t('vault.password.placeholder')}
                autoComplete="new-password"
                disabled={busy}
              />
            </label>
          )}
          <button className="primary-button" type="button" onClick={() => void mutate(canCreate ? 'CREATE_VAULT' : 'UNLOCK_VAULT')} disabled={busy || !password}>
            {busy && <SpinnerIcon className="spin" size={14} />}
            {busy ? t('vault.action.processing') : canCreate ? t('vault.action.create') : t('vault.action.unlock')}
          </button>
        </div>
      )}

      {status?.exists === true && !status.isUnlocked && (
        <p className="cost-warning">{t('vault.hint.locked')}</p>
      )}

      {status?.exists === true && (
        <div className="card-actions vault-actions">
          {canLock && <button className="secondary-button" type="button" onClick={() => void lock()} disabled={busy}>{t('vault.action.lock')}</button>}
          <button className="danger-text-button" type="button" onClick={() => void clearCacheAndKeys()} disabled={busy}>
            <TrashIcon size={14} />
            {t('vault.action.clearCache')}
          </button>
          <button className="danger-text-button" type="button" onClick={() => void clearVault()} disabled={busy}>
            <TrashIcon size={14} />
            {t('vault.action.delete')}
          </button>
        </div>
      )}

      <p className="card-status" role="status">{message}</p>
    </section>
  );
}
