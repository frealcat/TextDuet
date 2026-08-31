import { useEffect, useState } from 'react';
import { ChartLineIcon, TranslationIcon, SpinnerIcon, PlayIcon, CogIcon, StopIcon } from '@/src/icons';
import type {
  CostDashboard,
  PageTranslationState,
  PublicProviderSettings,
  RuntimeMessage,
  TranslationConsentStatus,
  TranslationDisplayMode,
} from '@/src/core/contracts';
import { DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE, resolveSystemLanguage } from '@/src/core/defaults';
import { LanguagePairPicker } from '@/src/ui/LanguagePairPicker';
import {
  parseCostDashboard,
  parseOperationResult,
  parsePageTranslationState,
  parsePublicProviderSettings,
  parseTranslationConsentStatus,
} from '@/src/core/schemas';
import { applyLocale, type LanguagePreference, resolveActiveLocale, useTranslation } from '@/src/i18n';

type StatusTone = 'danger' | 'info' | 'success' | 'warning';

export function App() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<PublicProviderSettings | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState(DEFAULT_SOURCE_LANGUAGE);
  const [targetLanguage, setTargetLanguage] = useState(DEFAULT_TARGET_LANGUAGE);
  const [costDashboard, setCostDashboard] = useState<CostDashboard | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [translationState, setTranslationState] = useState<PageTranslationState>({
    state: 'idle',
    hasRun: false,
  });
  const [displayMode, setDisplayMode] = useState<TranslationDisplayMode>('bilingual');
  const [consent, setConsent] = useState<TranslationConsentStatus | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);
  const [statusTone, setStatusTone] = useState<StatusTone>('info');

  useEffect(() => {
    browser.runtime
      .sendMessage({ type: 'GET_PROVIDER_SETTINGS' } satisfies RuntimeMessage)
      .then((value) => {
        const nextSettings = parsePublicProviderSettings(value);
        setSettings(nextSettings);
        const pref: LanguagePreference = (nextSettings.language as LanguagePreference | undefined) || 'auto';
        applyLocale(pref === 'auto' ? resolveActiveLocale() : pref, pref);
        setSourceLanguage(nextSettings.sourceLanguage || DEFAULT_SOURCE_LANGUAGE);
        setTargetLanguage(nextSettings.targetLanguage);
        setDisplayMode(nextSettings.displayMode);
        void browser.runtime.sendMessage({
          type: 'CONFIGURE_SELECTION_QUICK_ACTION',
          enabled: nextSettings.selectionQuickAction === true,
          sourceLanguage: nextSettings.sourceLanguage || DEFAULT_SOURCE_LANGUAGE,
          targetLanguage: nextSettings.targetLanguage,
          translationColor: nextSettings.translationColor,
        } satisfies RuntimeMessage).catch(() => undefined);
      })
      .catch(() => setStatusMessage(t('popup.status.readSettingsError'), 'danger'));
    browser.runtime
      .sendMessage({ type: 'GET_COST_DASHBOARD' } satisfies RuntimeMessage)
      .then((value) => setCostDashboard(parseCostDashboard(value)))
      .catch(() => setStatusMessage(t('popup.status.readDashboardError'), 'danger'));
    browser.runtime
      .sendMessage({ type: 'GET_ACTIVE_TAB_TRANSLATION_STATE' } satisfies RuntimeMessage)
      .then((value) => setTranslationState(parsePageTranslationState(value)))
      .catch(() => setTranslationState({ state: 'idle', hasRun: false }));
    browser.runtime
      .sendMessage({ type: 'GET_TRANSLATION_CONSENT' } satisfies RuntimeMessage)
      .then((value) => setConsent(parseTranslationConsentStatus(value)))
      .catch(() => setStatusMessage(t('popup.consent.error'), 'danger'));
  }, []);

  useEffect(() => {
    if (translationState.state !== 'progress') return;

    let isActive = true;
    const refreshState = async (): Promise<void> => {
      try {
        const value: unknown = await browser.runtime.sendMessage({
          type: 'GET_ACTIVE_TAB_TRANSLATION_STATE',
        } satisfies RuntimeMessage);
        if (isActive) setTranslationState(parsePageTranslationState(value));
      } catch {
        // A closed or navigated tab is reflected the next time the Popup opens.
      }
    };
    const timer = window.setInterval(() => void refreshState(), 400);
    void refreshState();

    return () => {
      isActive = false;
      window.clearInterval(timer);
    };
  }, [translationState.state]);

  useEffect(() => {
    if (translationState.message) setStatus(translationState.message);
  }, [translationState.message]);

  function setStatusMessage(message: string, tone: StatusTone = 'info'): void {
    setStatus(message);
    setStatusTone(tone);
  }

  async function translate(): Promise<void> {
    if (!settings?.hasApiKey || !settings.model) {
      await browser.runtime.openOptionsPage();
      return;
    }
    if (!consent?.isConfirmed) {
      setStatusMessage(t('popup.consent.error'), 'warning');
      return;
    }

    setBusy(true);
    setStatusMessage(t('popup.status.translating'));
    try {
      const rawResult: unknown = await browser.runtime.sendMessage({
        type: 'TRANSLATE_ACTIVE_TAB',
        sourceLanguage,
        targetLanguage: targetLanguage === DEFAULT_TARGET_LANGUAGE ? resolveSystemLanguage() : targetLanguage,
      } satisfies RuntimeMessage);
      const result = parseOperationResult(rawResult);
      setStatusMessage(
        result.message || (result.ok ? t('popup.status.translateStarted') : t('popup.status.translateFailed')),
        result.ok ? 'success' : 'danger',
      );
      if (result.ok) setTranslationState({ state: 'progress', hasRun: true });
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : t('popup.status.translateFailed'), 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function confirmConsent(): Promise<void> {
    setConsentBusy(true);
    setStatusMessage('');
    try {
      const rawStatus: unknown = await browser.runtime.sendMessage({
        type: 'CONFIRM_TRANSLATION_CONSENT',
      } satisfies RuntimeMessage);
      setConsent(parseTranslationConsentStatus(rawStatus));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : t('popup.consent.confirmFailed'), 'danger');
    } finally {
      setConsentBusy(false);
    }
  }

  async function changeLanguage(nextSourceLanguage: string, nextTargetLanguage: string): Promise<void> {
    setSourceLanguage(nextSourceLanguage);
    setTargetLanguage(nextTargetLanguage);
    try {
      const result = parseOperationResult(await browser.runtime.sendMessage({
        type: 'SET_LANGUAGE_PREFERENCES', sourceLanguage: nextSourceLanguage, targetLanguage: nextTargetLanguage,
      } satisfies RuntimeMessage));
      if (!result.ok) throw new Error(result.message || t('popup.status.langSaveFailed'));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : t('popup.status.langSaveFailed'), 'danger');
    }
  }

  async function stop(): Promise<void> {
    setBusy(true);
    try {
      const rawResult: unknown = await browser.runtime.sendMessage({
        type: 'STOP_ACTIVE_TAB',
      } satisfies RuntimeMessage);
      const result = parseOperationResult(rawResult);
      setStatusMessage(result.message || t('popup.status.stopped'), result.ok ? 'success' : 'danger');
      if (result.ok) setTranslationState({ state: 'stopped', hasRun: true });
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : t('popup.status.stopFailed'), 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function toggleTranslation(): Promise<void> {
    if (translationState.state === 'progress') {
      await stop();
      return;
    }
    await translate();
  }

  async function changeDisplayMode(nextMode: TranslationDisplayMode): Promise<void> {
    const previousMode = displayMode;
    setDisplayMode(nextMode);
    try {
      const rawResult: unknown = await browser.runtime.sendMessage({
        type: 'SET_ACTIVE_TAB_DISPLAY_MODE',
        displayMode: nextMode,
      } satisfies RuntimeMessage);
      const result = parseOperationResult(rawResult);
      if (!result.ok) throw new Error(result.message || t('popup.status.modeChangeFailed'));
      setStatusMessage(result.message || t('popup.status.modeChanged'), 'success');
    } catch (error) {
      setDisplayMode(previousMode);
      setStatusMessage(error instanceof Error ? error.message : t('popup.status.modeChangeFailed'), 'danger');
    }
  }

  async function changeSelectionQuickAction(enabled: boolean): Promise<void> {
    if (!settings) return;
    setSettings({ ...settings, selectionQuickAction: enabled });
    try {
      const result = parseOperationResult(await browser.runtime.sendMessage({
        type: 'SET_SELECTION_QUICK_ACTION', enabled,
      } satisfies RuntimeMessage));
      if (!result.ok) throw new Error(result.message || t('popup.status.quickActionFailed'));
      await browser.runtime.sendMessage({
        type: 'CONFIGURE_SELECTION_QUICK_ACTION',
        enabled,
        sourceLanguage,
        targetLanguage,
        translationColor: settings.translationColor,
      } satisfies RuntimeMessage);
    } catch (error) {
      setSettings((current) => current ? { ...current, selectionQuickAction: !enabled } : current);
      setStatusMessage(error instanceof Error ? error.message : t('popup.status.quickActionFailed'), 'danger');
    }
  }

  async function changeModel(model: string): Promise<void> {
    if (!settings) return;
    const previousModel = settings.model;
    setSettings({ ...settings, model });
    try {
      const rawResult: unknown = await browser.runtime.sendMessage({
        type: 'SET_ACTIVE_MODEL',
        model,
      } satisfies RuntimeMessage);
      const result = parseOperationResult(rawResult);
      if (!result.ok) throw new Error(result.message || t('popup.status.modelChangeFailed'));
      setStatusMessage(result.message || t('popup.status.modelChanged'), 'success');
    } catch (error) {
      setSettings((current) => current ? { ...current, model: previousModel } : current);
      setStatusMessage(error instanceof Error ? error.message : t('popup.status.modelChangeFailed'), 'danger');
    }
  }

  const modelOptions = settings
    ? [...new Set([settings.model, ...(settings.models || [])].filter(Boolean))]
    : [];
  const isTranslating = translationState.state === 'progress';

  return (
    <main className="popup-shell">
      <header className="brand-row">
        <div className="brand-mark" aria-hidden="true">
          <TranslationIcon size={24} />
        </div>
        <div>
          <h1>TextDuet</h1>
          <p>{t('popup.brand.subtitle')}</p>
        </div>
      </header>

      {consent && !consent.isConfirmed && (
        <section className="consent-card" aria-labelledby="translation-consent-title">
          <h2 id="translation-consent-title">{t('popup.consent.title')}</h2>
          <p>{t('popup.consent.description')}</p>
          <button
            className="primary-button"
            type="button"
            onClick={() => void confirmConsent()}
            disabled={consentBusy}
          >
            {consentBusy && <SpinnerIcon className="spin" size={16} />}
            {consentBusy ? t('popup.button.processing') : t('popup.consent.confirm')}
          </button>
        </section>
      )}

      <section className="control-card" aria-label={t('popup.controls.aria')}>
        <LanguagePairPicker sourceLanguage={sourceLanguage} targetLanguage={targetLanguage} onChange={(source, target) => void changeLanguage(source, target)} compact />

        {modelOptions.length > 1 && (
          <label>
            <span>{t('popup.model.label')}</span>
            <select value={settings?.model || ''} onChange={(event) => void changeModel(event.target.value)}>
              {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          </label>
        )}

        <button className="primary-button" type="button" onClick={toggleTranslation} disabled={busy || consent === null}>
          {busy ? (
            <SpinnerIcon className="spin" size={16} />
          ) : isTranslating ? (
            <StopIcon size={16} />
          ) : (
            <PlayIcon size={16} />
          )}
          {settings?.hasApiKey && consent?.isConfirmed
            ? busy
              ? t('popup.button.processing')
              : isTranslating
                ? t('popup.button.stop')
                : t('popup.button.translate')
            : consent === null
              ? t('popup.consent.loading')
              : settings?.hasApiKey
                ? t('popup.consent.title')
                : t('popup.button.setup')}
        </button>

        <div className="display-segments" aria-label={t('popup.display.aria')}>
          <button
            type="button"
            aria-pressed={displayMode === 'bilingual'}
            disabled={!translationState.hasRun}
            onClick={() => void changeDisplayMode('bilingual')}
          >
            {t('popup.display.bilingual')}
          </button>
          <button
            type="button"
            aria-pressed={displayMode === 'source-only'}
            disabled={!translationState.hasRun}
            onClick={() => void changeDisplayMode('source-only')}
          >
            {t('popup.display.sourceOnly')}
          </button>
          <button
            type="button"
            aria-pressed={displayMode === 'translated-only'}
            disabled={!translationState.hasRun}
            onClick={() => void changeDisplayMode('translated-only')}
          >
            {t('popup.display.translatedOnly')}
          </button>
        </div>
        <label className="quick-action-toggle">
          <input type="checkbox" checked={settings?.selectionQuickAction === true} onChange={(event) => void changeSelectionQuickAction(event.target.checked)} />
          <span>{t('popup.quickAction.label')}</span>
        </label>
      </section>

      <section className="cost-card" aria-label={t('popup.cost.aria')}>
        <div className="cost-title">
          <span>
            <ChartLineIcon size={16} />
            {t('popup.cost.title')}
          </span>
          {costDashboard?.today.hasEstimatedUsage && <small>{t('popup.cost.estimated')}</small>}
        </div>
        {costDashboard ? (
          <>
            <strong>
              {t('popup.cost.totalTokens', {
                count: (costDashboard.today.inputTokens + costDashboard.today.outputTokens).toLocaleString('en-US'),
              })}
            </strong>
            <p>
              {t('popup.cost.inputOutput', {
                input: costDashboard.today.inputTokens.toLocaleString('en-US'),
                output: costDashboard.today.outputTokens.toLocaleString('en-US'),
              })}
            </p>
            {costDashboard.today.budgetEnabled && (
              <div className="budget-progress">
                <progress
                  max="100"
                  value={Math.min(costDashboard.today.budgetPercentage, 100)}
                >
                  {costDashboard.today.budgetPercentage.toFixed(0)}%
                </progress>
                <span>
                  {budgetStatusText(costDashboard.today.budgetPercentage, t)} · {t('popup.cost.budgetNote')}
                </span>
              </div>
            )}
            {!costDashboard.isLedgerAvailable && (
              <p className="ledger-warning">{t('popup.cost.ledgerWarning')}</p>
            )}
          </>
        ) : (
          <p>{t('popup.cost.loading')}</p>
        )}
      </section>

      {status && (
        <p
          className={`td-badge td-badge--${statusTone}`}
          role="status"
          aria-live="polite"
        >
          {status}
        </p>
      )}

      <footer>
        <span className={settings?.hasApiKey ? 'ready-dot' : 'idle-dot'} aria-hidden="true" />
        <span>{settings?.hasApiKey ? settings.model || t('popup.footer.modelPending') : t('popup.footer.noApiKey')}</span>
        <button type="button" onClick={() => browser.runtime.openOptionsPage()} aria-label={t('popup.settings.aria')}>
          <CogIcon size={14} />
          {t('popup.footer.openSettings')}
        </button>
      </footer>
    </main>
  );
}

function budgetStatusText(percentage: number, t: (key: string, params?: Record<string, string | number>) => string): string {
  const percent = percentage.toFixed(0);
  if (percentage >= 100) return t('popup.budget.reached', { percent });
  if (percentage >= 80) return t('popup.budget.near', { percent });
  if (percentage >= 50) return t('popup.budget.half', { percent });
  return t('popup.budget.used', { percent });
}
