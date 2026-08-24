import { useEffect, useState } from 'react';
import { KeyRound, LoaderCircle, PlugZap, Save } from 'lucide-react';
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
import { PersistenceOptions } from './PersistenceOptions';
import { CostSettingsCard } from './CostSettingsCard';
import { CacheSettingsCard } from './CacheSettingsCard';
import { UsageDashboardCard } from './UsageDashboardCard';
import { CompatibilityDiagnosticsCard } from './CompatibilityDiagnosticsCard';
import { TranslationAppearanceControls } from './TranslationAppearanceControls';
import { ModelTagInput } from './ModelTagInput';
import { LanguagePairPicker } from '@/src/ui/LanguagePairPicker';

export function App() {
  const [settings, setSettings] = useState<ProviderSettings>(DEFAULT_PROVIDER_SETTINGS);
  const [apiKey, setApiKey] = useState('');
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
  const [configurationRevision, setConfigurationRevision] = useState(0);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const selectedPreset = PROVIDER_PRESETS.find((preset) => preset.baseUrl === settings.baseUrl);

  useEffect(() => {
    browser.runtime
      .sendMessage({ type: 'GET_PROVIDER_SETTINGS' } satisfies RuntimeMessage)
      .then((value) => {
        const saved = parsePublicProviderSettings(value);
        const { hasApiKey, ...providerSettings } = saved;
        setSettings({
          ...providerSettings,
          models: normalizeModelList(providerSettings.models, providerSettings.model),
          translationColor: providerSettings.translationColor || DEFAULT_TRANSLATION_COLOR,
          sourceLanguage: providerSettings.sourceLanguage || DEFAULT_SOURCE_LANGUAGE,
        });
        setHasSavedApiKey(hasApiKey);
      })
      .catch(() => setStatus('读取配置失败，请重新加载扩展后重试'));
  }, []);

  function update<K extends keyof ProviderSettings>(key: K, value: ProviderSettings[K]): void {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function selectPreset(preset: (typeof PROVIDER_PRESETS)[number]): void {
    update('baseUrl', preset.baseUrl);
  }

  async function save(testAfterSave = false): Promise<void> {
    setBusy(true);
    setStatus('');

    try {
      const normalizedSettings: ProviderSettings = {
        ...settings,
        model: settings.model.trim(),
        models: normalizeModelList(settings.models, settings.model),
        translationColor: (settings.translationColor || DEFAULT_TRANSLATION_COLOR).trim(),
        selectionQuickAction: settings.selectionQuickAction === true,
      };
      const originPattern = toOriginPattern(settings.baseUrl);
      const granted = await browser.permissions.request({ origins: [originPattern] });
      if (!granted) {
        throw new Error('需要访问模型 API 域名才能发送翻译请求');
      }

      const rawResult: unknown = await browser.runtime.sendMessage({
        type: 'SAVE_PROVIDER_SETTINGS',
        settings: normalizedSettings,
        apiKey: apiKey || undefined,
      } satisfies RuntimeMessage);
      const result = parseOperationResult(rawResult);

      if (!result.ok) {
        throw new Error(result.message || '保存失败');
      }

      setHasSavedApiKey(Boolean(apiKey) || hasSavedApiKey);
      setSettings(normalizedSettings);
      setApiKey('');
      setConfigurationRevision((current) => current + 1);
      await browser.runtime.sendMessage({
        type: 'CONFIGURE_SELECTION_QUICK_ACTION',
        enabled: normalizedSettings.selectionQuickAction === true,
        sourceLanguage: normalizedSettings.sourceLanguage,
        targetLanguage: normalizedSettings.targetLanguage,
        translationColor: normalizedSettings.translationColor,
      } satisfies RuntimeMessage).catch(() => undefined);

      if (testAfterSave) {
        setStatus('正在连接模型…');
        const rawTestResult: unknown = await browser.runtime.sendMessage({
          type: 'TEST_PROVIDER',
        } satisfies RuntimeMessage);
        const testResult = parseOperationResult(rawTestResult);
        if (!testResult.ok) {
          throw new Error(testResult.message || '连接测试失败');
        }
        setStatus(testResult.message || '连接成功');
      } else {
        setStatus(result.message || '配置已保存');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="settings-shell">
      <header>
        <div className="eyebrow">本地优先 · 用户自带模型</div>
        <h1>连接你的翻译模型</h1>
        <p>
          网页文本会从浏览器直接发送给你选择的模型服务商，不经过本项目的服务器。
        </p>
      </header>

      <section className="settings-card" aria-labelledby="provider-heading">
        <div className="section-heading">
          <div>
            <span className="step">01</span>
            <h2 id="provider-heading">模型服务</h2>
          </div>
          <span className={hasSavedApiKey ? 'badge success' : 'badge'}>
            <KeyRound aria-hidden="true" size={12} strokeWidth={2} />
            {hasSavedApiKey ? '已保存密钥' : '尚未配置'}
          </span>
        </div>

        <div className="preset-row" aria-label="服务商预设">
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
            <span>API Base URL</span>
            <input
              type="url"
              value={settings.baseUrl}
              onChange={(event) => update('baseUrl', event.target.value)}
              placeholder="https://api.example.com/v1"
              spellCheck={false}
            />
            <small>插件会自动追加 <code>/chat/completions</code></small>
            {selectedPreset?.id === 'qwen' ? (
              <small>使用阿里云百炼 OpenAI 兼容模式；请填写百炼控制台中已开通的模型名称。</small>
            ) : null}
          </label>

          <label className="wide-field">
            <span>API Key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={hasSavedApiKey ? '已保存；留空表示不修改' : '粘贴你的 API Key'}
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <div className="wide-field">
            <ModelTagInput
              models={settings.models || []}
              activeModel={settings.model}
              placeholder={selectedPreset?.modelPlaceholder || '例如：your-model-name'}
              disabled={busy}
              onModelsChange={(models) => update('models', models)}
              onActiveModelChange={(model) => update('model', model)}
            />
          </div>
        </div>
      </section>

      <section className="settings-card" aria-labelledby="privacy-heading">
        <div className="section-heading">
          <div>
            <span className="step">02</span>
            <h2 id="privacy-heading">密钥与默认偏好</h2>
          </div>
        </div>

        <fieldset>
          <legend>API Key 保存方式</legend>
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
          <span>选中文字后显示快捷翻译图标</span>
          <small>关闭后仍可通过右键菜单翻译选区。</small>
        </label>
      </section>

      <section className="settings-card" aria-labelledby="prompt-heading">
        <div className="section-heading">
          <div>
            <span className="step">03</span>
            <h2 id="prompt-heading">高级翻译指令</h2>
          </div>
          <span className="optional">可选</span>
        </div>
        <label>
          <span className="sr-only">自定义系统提示词</span>
          <textarea
            value={settings.customSystemPrompt}
            onChange={(event) => update('customSystemPrompt', event.target.value)}
            placeholder="留空时使用内置的安全翻译提示词。后续可在这里加入术语、文风或行业要求。"
          />
        </label>
      </section>

      <UsageDashboardCard
        baseUrl={settings.baseUrl}
        model={settings.model}
        refreshKey={configurationRevision}
      />
      <CostSettingsCard model={settings.model} />
      <CacheSettingsCard />
      <CompatibilityDiagnosticsCard />

      <div className="action-bar">
        <p role="status">{status}</p>
        <button className="secondary-button" type="button" onClick={() => save(true)} disabled={busy}>
          <PlugZap aria-hidden="true" size={15} strokeWidth={2} />
          测试连接
        </button>
        <button className="primary-button" type="button" onClick={() => save(false)} disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" aria-hidden="true" size={15} strokeWidth={2} />
          ) : (
            <Save aria-hidden="true" size={15} strokeWidth={2} />
          )}
          {busy ? '处理中…' : '保存配置'}
        </button>
      </div>
    </main>
  );
}

function toOriginPattern(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:') {
    throw new Error('API 地址必须使用 HTTPS');
  }
  return `${url.origin}/*`;
}

function normalizeModelList(models: readonly string[] | undefined, activeModel: string): string[] {
  return [...new Set([activeModel.trim(), ...(models || []).map((model) => model.trim())].filter(Boolean))];
}
