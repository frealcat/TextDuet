import { useEffect, useMemo, useState } from 'react';
import { KeyIcon, PlugIcon, SaveIcon, SpinnerIcon } from '@/src/icons';
import type { ProviderSettings, RuntimeMessage } from '@/src/core/contracts';
import {
  DEFAULT_PROVIDER_SETTINGS,
  DEFAULT_TRANSLATION_COLOR,
  PROVIDER_PRESETS,
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
  SUPPORTED_SOURCE_LANGUAGES,
  SUPPORTED_TARGET_LANGUAGES,
} from '@/src/core/defaults';
import { parseOperationResult, parsePublicProviderSettings } from '@/src/core/schemas';
import {
  migrateProviderModelsToOriginCache,
  isSavedApiKeyForOrigin,
  normalizeBaseUrlOrigin,
  switchBaseUrlWithModelCache,
  writeActiveModelToOriginCache,
} from '@/src/storage/provider-models';
import { PersistenceOptions } from './PersistenceOptions';
import { LanguageSelector } from './LanguageSelector';
import { CostSettingsCard } from './CostSettingsCard';
import { CacheSettingsCard } from './CacheSettingsCard';
import { UsageDashboardCard } from './UsageDashboardCard';
import { CompatibilityDiagnosticsCard } from './CompatibilityDiagnosticsCard';
import { TranslationAppearanceControls } from './TranslationAppearanceControls';
import { ModelTagInput } from './ModelTagInput';
import { CustomLocaleCard } from './CustomLocaleCard';
import { VaultSettingsCard } from './VaultSettingsCard';
import { OptionsLayout } from './Layout';
import type { SidebarSection } from './Sidebar';
// The picker is a tiny HTML select component (no ECharts), so a
// static import is cheaper than the Suspense + React.lazy wrapper,
// which would otherwise pull a duplicate ~150 kB React runtime into
// a separate i18n chunk.
import { LanguagePairPicker } from '@/src/ui/LanguagePairPicker';
import { applyLocale, type LanguagePreference, resolveActiveLocale, useTranslation } from '@/src/i18n';

type StatusTone = 'danger' | 'info' | 'success' | 'warning';

export function App() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<ProviderSettings>(DEFAULT_PROVIDER_SETTINGS);
  const [apiKey, setApiKey] = useState('');
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
  // `GET_PROVIDER_SETTINGS` reports the key state for one Provider origin.
  // Keep that origin beside the flag so a later URL edit cannot display the
  // previous Provider's state as if it belonged to the current one.
  const [savedApiKeyOrigin, setSavedApiKeyOrigin] = useState<string | null>(null);
  const [configurationRevision, setConfigurationRevision] = useState(0);
  const [status, setStatus] = useState('');
  const [statusTone, setStatusTone] = useState<StatusTone>('info');
  const [busy, setBusy] = useState(false);
  const selectedPreset = PROVIDER_PRESETS.find((preset) => preset.baseUrl === settings.baseUrl);

  useEffect(() => {
    browser.runtime
      .sendMessage({ type: 'GET_PROVIDER_SETTINGS' } satisfies RuntimeMessage)
      .then((value) => {
        const saved = parsePublicProviderSettings(value);
        const { hasApiKey, ...providerSettings } = saved;
        const migrated = migrateProviderModelsToOriginCache({
          ...providerSettings,
          models: normalizeModelList(providerSettings.models, providerSettings.model),
          translationColor: providerSettings.translationColor || DEFAULT_TRANSLATION_COLOR,
          sourceLanguage: providerSettings.sourceLanguage || DEFAULT_SOURCE_LANGUAGE,
        });
        setSettings(migrated);
        setHasSavedApiKey(hasApiKey);
        setSavedApiKeyOrigin(normalizeBaseUrlOrigin(saved.baseUrl));
        const pref: LanguagePreference = (migrated.language as LanguagePreference | undefined) || 'auto';
        applyLocale(pref === 'auto' ? resolveActiveLocale() : pref, pref);
      })
      .catch(() => setStatusMessage(t('options.status.readConfigFailed'), 'danger'));
  }, []);

  function setStatusMessage(message: string, tone: StatusTone = 'info'): void {
    setStatus(message);
    setStatusTone(tone);
  }

  function update<K extends keyof ProviderSettings>(key: K, value: ProviderSettings[K]): void {
    if (key === 'language') {
      const pref = value as unknown as LanguagePreference;
      // Apply immediately so every t() call (including this render pass)
      // sees the new locale. The settings state is updated below.
      applyLocale(pref === 'auto' ? resolveActiveLocale() : pref, pref);
    }
    if (key === 'baseUrl' && typeof value === 'string' && value !== settings.baseUrl) {
      const previousOrigin = normalizeBaseUrlOrigin(settings.baseUrl);
      const nextOrigin = normalizeBaseUrlOrigin(value);
      if (previousOrigin !== nextOrigin) {
        // The public status is scoped to the origin returned by the Service
        // Worker. Until this new origin is saved and re-read, the old flag is
        // not evidence that a key exists here.
        setHasSavedApiKey(false);
        setSavedApiKeyOrigin(null);
      }
    }
    setSettings((current) => {
      if (key === 'baseUrl' && typeof value === 'string' && value !== current.baseUrl) {
        return switchBaseUrlWithModelCache(current, value);
      }
      if (key === 'model' && typeof value === 'string') {
        return writeActiveModelToOriginCache(current, { model: value });
      }
      if (key === 'models' && Array.isArray(value)) {
        return writeActiveModelToOriginCache(current, { models: value });
      }
      return { ...current, [key]: value };
    });
  }

  function selectPreset(preset: (typeof PROVIDER_PRESETS)[number]): void {
    update('baseUrl', preset.baseUrl);
  }

  async function save(testAfterSave = false): Promise<void> {
    setBusy(true);
    setStatusMessage('');

    try {
      const normalizedSettings: ProviderSettings = {
        ...settings,
        model: settings.model.trim(),
        models: normalizeModelList(settings.models, settings.model),
        translationColor: (settings.translationColor || DEFAULT_TRANSLATION_COLOR).trim(),
        selectionQuickAction: settings.selectionQuickAction === true,
        headerPopupRescan: settings.headerPopupRescan === true,
      };
      const originPattern = toOriginPattern(settings.baseUrl, t('options.error.httpsRequired'));
      const granted = await browser.permissions.request({ origins: [originPattern] });
      if (!granted) {
        throw new Error(t('options.error.originPermissionRequired'));
      }

      const rawResult: unknown = await browser.runtime.sendMessage({
        type: 'SAVE_PROVIDER_SETTINGS',
        settings: normalizedSettings,
        apiKey: apiKey || undefined,
      } satisfies RuntimeMessage);
      const result = parseOperationResult(rawResult);

      if (!result.ok) {
        throw new Error(result.message || t('options.status.saveFailed'));
      }

      setSettings(normalizedSettings);
      setApiKey('');
      setConfigurationRevision((current) => current + 1);

      // SAVE_PROVIDER_SETTINGS intentionally returns only an operation
      // result. Re-read the redacted public settings so the badge reflects
      // the Service Worker's current-origin lookup, including saves that
      // leave the API key field blank.
      await browser.runtime
        .sendMessage({ type: 'GET_PROVIDER_SETTINGS' } satisfies RuntimeMessage)
        .then((value) => {
          const refreshed = parsePublicProviderSettings(value);
          setHasSavedApiKey(refreshed.hasApiKey);
          setSavedApiKeyOrigin(normalizeBaseUrlOrigin(refreshed.baseUrl));
        })
        .catch(() => {
          // Do not resurrect a stale origin's state when the refresh fails.
          setHasSavedApiKey(false);
          setSavedApiKeyOrigin(null);
        });

      await browser.runtime.sendMessage({
        type: 'CONFIGURE_SELECTION_QUICK_ACTION',
        enabled: normalizedSettings.selectionQuickAction === true,
        sourceLanguage: normalizedSettings.sourceLanguage,
        targetLanguage: normalizedSettings.targetLanguage,
        translationColor: normalizedSettings.translationColor,
      } satisfies RuntimeMessage).catch(() => undefined);

      if (testAfterSave) {
        setStatusMessage(t('options.status.connecting'));
        const rawTestResult: unknown = await browser.runtime.sendMessage({
          type: 'TEST_PROVIDER',
        } satisfies RuntimeMessage);
        const testResult = parseOperationResult(rawTestResult);
        if (!testResult.ok) {
          throw new Error(testResult.message || t('options.status.testConnectionFailed'));
        }
        setStatusMessage(testResult.message || t('options.status.testConnectionSuccess'), 'success');
      } else {
        setStatusMessage(result.message || t('options.status.configSaved'), 'success');
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : t('options.status.operationFailed'), 'danger');
    } finally {
      setBusy(false);
    }
  }

  // Sidebar 4 段配置(语言 / 模型 / 用量 / 高级),子项保留原 step 编号
  // 便于 i18n 与 anchor 滚动。TD-2026-025 P2 引入,P4 改用 v2 token。
  const sidebarSections: SidebarSection[] = useMemo(
    () => [
      {
        id: 'section-language',
        label: t('options.sidebar.language'),
        children: [
          { step: '00', label: t('language.section.title') },
          { step: '06', label: t('language.custom.title') },
        ],
      },
      {
        id: 'section-model',
        label: t('options.sidebar.model'),
        children: [
          { step: '01', label: t('options.section.provider.title') },
          { step: '02', label: t('options.section.preferences.title') },
          { step: '03', label: t('options.section.prompt.title') },
        ],
      },
      {
        id: 'section-usage',
        label: t('options.sidebar.usage'),
        children: [
          { step: '04', label: t('usage.section.title') },
          { step: '05', label: t('cost.section.title') },
          { step: '07', label: t('cache.section.title') },
        ],
      },
      {
        id: 'section-advanced',
        label: t('options.sidebar.advanced'),
        children: [
          { step: '08', label: t('diagnostics.section.title') },
          { step: '09', label: t('vault.section.title') },
        ],
      },
    ],
    [t],
  );
  const hasCurrentOriginSavedApiKey = isSavedApiKeyForOrigin(
    hasSavedApiKey,
    savedApiKeyOrigin,
    settings.baseUrl,
  );

  return (
    <OptionsLayout
      sections={sidebarSections}
      brand={
        <header>
          <div className="eyebrow">{t('options.brand.eyebrow')}</div>
          <h1>{t('options.brand.title')}</h1>
          <p>{t('options.brand.description')}</p>
        </header>
      }
      actionBar={
        <div className="action-bar">
          <p
            className={`td-badge td-badge--${statusTone}`}
            role="status"
            aria-live="polite"
          >
            {status}
          </p>
          <button className="secondary-button" type="button" onClick={() => save(true)} disabled={busy}>
            <PlugIcon size={16} />
            {t('options.action.testConnection')}
          </button>
          <button className="primary-button" type="button" onClick={() => save(false)} disabled={busy}>
            {busy ? (
              <SpinnerIcon className="spin" size={16} />
            ) : (
              <SaveIcon size={16} />
            )}
            {busy ? t('options.action.processing') : t('options.action.saveConfig')}
          </button>
        </div>
      }
    >
      <section
        id="section-language-00"
        className="settings-card"
        aria-labelledby="language-heading"
      >
        <div className="section-heading">
          <div>
            <span className="step">00</span>
            <h2 id="language-heading">{t('language.section.title')}</h2>
          </div>
        </div>
        <p className="field-hint">{t('language.section.description')}</p>
        <LanguageSelector
          value={(settings.language as LanguagePreference | undefined) || 'auto'}
          disabled={busy}
          onChange={(value) => update('language', value)}
        />
      </section>

      <section
        id="section-model-01"
        className="settings-card"
        aria-labelledby="provider-heading"
      >
        <div className="section-heading">
          <div>
            <span className="step">01</span>
            <h2 id="provider-heading">{t('options.section.provider.title')}</h2>
          </div>
          <span className={hasCurrentOriginSavedApiKey ? 'badge success' : 'badge'}>
            <KeyIcon size={12} />
            {hasCurrentOriginSavedApiKey ? t('options.apiKey.badge.saved') : t('options.apiKey.badge.empty')}
          </span>
        </div>

        <div className="preset-row" aria-label={t('options.providerPresets.aria')}>
          {PROVIDER_PRESETS.map((preset) => (
            <button
              className={settings.baseUrl === preset.baseUrl ? 'preset active' : 'preset'}
              key={preset.id}
              type="button"
              onClick={() => selectPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="field-grid">
          <label className="wide-field">
            <span>{t('options.apiBaseUrl.label')}</span>
            <input
              type="url"
              value={settings.baseUrl}
              onChange={(event) => update('baseUrl', event.target.value)}
              placeholder="https://api.example.com/v1"
              spellCheck={false}
            />
            <small>{t('options.apiBaseUrl.pathNote')}<code>/chat/completions</code></small>
            {selectedPreset?.id === 'qwen' ? (
              <small>{t('options.apiBaseUrl.qwenNote')}</small>
            ) : null}
          </label>

          <label className="wide-field">
            <span>{t('options.apiKey.label')}</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={hasCurrentOriginSavedApiKey
                ? t('options.apiKey.placeholderSaved')
                : t('options.apiKey.placeholderNew')}
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <div className="wide-field">
            <ModelTagInput
              models={settings.models || []}
              activeModel={settings.model}
              placeholder={selectedPreset?.modelPlaceholder || t('options.modelTag.placeholderExample')}
              disabled={busy}
              onModelsChange={(models) => update('models', models)}
              onActiveModelChange={(model) => update('model', model)}
            />
          </div>
        </div>
      </section>

      <section
        id="section-model-02"
        className="settings-card"
        aria-labelledby="privacy-heading"
      >
        <div className="section-heading">
          <div>
            <span className="step">02</span>
            <h2 id="privacy-heading">{t('options.section.preferences.title')}</h2>
          </div>
        </div>

        <fieldset>
          <legend>{t('options.apiKey.persistenceLegend')}</legend>
          <PersistenceOptions
            value={settings.apiKeyPersistence}
            disabled={busy}
            onChange={(value) => update('apiKeyPersistence', value)}
          />
        </fieldset>

        <LanguagePairPicker
          sourceLanguage={settings.sourceLanguage || DEFAULT_SOURCE_LANGUAGE}
          targetLanguage={settings.targetLanguage}
          onChange={(source, target) => setSettings((current) => ({ ...current, sourceLanguage: source, targetLanguage: target }))}
        />

        <TranslationAppearanceControls
          displayMode={settings.displayMode}
          translationColor={settings.translationColor || DEFAULT_TRANSLATION_COLOR}
          disabled={busy}
          onDisplayModeChange={(value) => update('displayMode', value)}
          onTranslationColorChange={(value) => update('translationColor', value)}
        />

        <label className="quick-action-toggle">
          <input
            type="checkbox"
            checked={settings.selectionQuickAction === true}
            onChange={(event) => update('selectionQuickAction', event.target.checked)}
          />
          <span>{t('options.quickAction.label')}</span>
          <small>{t('options.quickAction.hint')}</small>
        </label>

        <label className="quick-action-toggle">
          <input
            type="checkbox"
            checked={settings.headerPopupRescan === true}
            onChange={(event) => update('headerPopupRescan', event.target.checked)}
          />
          <span>{t('options.headerPopup.label')}</span>
          <small>
            {t('options.headerPopup.hint')}
          </small>
        </label>
      </section>

      <section
        id="section-model-03"
        className="settings-card"
        aria-labelledby="prompt-heading"
      >
        <div className="section-heading">
          <div>
            <span className="step">03</span>
            <h2 id="prompt-heading">{t('options.section.prompt.title')}</h2>
          </div>
          <span className="optional">{t('options.section.prompt.optional')}</span>
        </div>
        <label>
          <span className="sr-only">{t('options.prompt.aria')}</span>
          <textarea
            value={settings.customSystemPrompt}
            onChange={(event) => update('customSystemPrompt', event.target.value)}
            placeholder={t('options.prompt.placeholder')}
          />
        </label>
      </section>

      <UsageDashboardCard
        id="section-usage-04"
        baseUrl={settings.baseUrl}
        model={settings.model}
        refreshKey={configurationRevision}
      />
      <CostSettingsCard id="section-usage-05" model={settings.model} />
      <CacheSettingsCard id="section-usage-07" />
      <CompatibilityDiagnosticsCard id="section-advanced-08" />
      <VaultSettingsCard id="section-advanced-09" />
      <CustomLocaleCard
        id="section-language-06"
        currentLanguagePreference={(settings.language as string | undefined) || 'auto'}
        onLocaleChange={(tag) => update('language', tag)}
      />
    </OptionsLayout>
  );
}

function toOriginPattern(baseUrl: string, httpsRequiredMessage: string): string {
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:') {
    throw new Error(httpsRequiredMessage);
  }
  return `${url.origin}/*`;
}

function normalizeModelList(models: readonly string[] | undefined, activeModel: string): string[] {
  return [...new Set([activeModel.trim(), ...(models || []).map((model) => model.trim())].filter(Boolean))];
}
