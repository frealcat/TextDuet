import { useEffect, useState } from 'react';
import { Activity, Languages, LoaderCircle, Play, Settings, Square } from 'lucide-react';
import type {
  CostDashboard,
  PageTranslationState,
  PublicProviderSettings,
  RuntimeMessage,
  TranslationDisplayMode,
} from '@/src/core/contracts';
import { DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE, resolveSystemLanguage } from '@/src/core/defaults';
import { LanguagePairPicker } from '@/src/ui/LanguagePairPicker';
import {
  parseCostDashboard,
  parseOperationResult,
  parsePageTranslationState,
  parsePublicProviderSettings,
} from '@/src/core/schemas';

export function App() {
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

  useEffect(() => {
    browser.runtime
      .sendMessage({ type: 'GET_PROVIDER_SETTINGS' } satisfies RuntimeMessage)
      .then((value) => {
        const nextSettings = parsePublicProviderSettings(value);
        setSettings(nextSettings);
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
      .catch(() => setStatus('无法读取扩展配置'));
    browser.runtime
      .sendMessage({ type: 'GET_COST_DASHBOARD' } satisfies RuntimeMessage)
      .then((value) => setCostDashboard(parseCostDashboard(value)))
      .catch(() => setStatus('无法读取本地用量摘要'));
    browser.runtime
      .sendMessage({ type: 'GET_ACTIVE_TAB_TRANSLATION_STATE' } satisfies RuntimeMessage)
      .then((value) => setTranslationState(parsePageTranslationState(value)))
      .catch(() => setTranslationState({ state: 'idle', hasRun: false }));
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

  async function translate(): Promise<void> {
    if (!settings?.hasApiKey || !settings.model) {
      await browser.runtime.openOptionsPage();
      return;
    }

    setBusy(true);
    setStatus('正在提取并翻译网页…');
    try {
      const rawResult: unknown = await browser.runtime.sendMessage({
        type: 'TRANSLATE_ACTIVE_TAB',
        sourceLanguage,
        targetLanguage: targetLanguage === DEFAULT_TARGET_LANGUAGE ? resolveSystemLanguage() : targetLanguage,
      } satisfies RuntimeMessage);
      const result = parseOperationResult(rawResult);
      setStatus(result.message || (result.ok ? '翻译已开始' : '翻译失败'));
      if (result.ok) setTranslationState({ state: 'progress', hasRun: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '翻译失败');
    } finally {
      setBusy(false);
    }
  }

  async function changeLanguage(nextSourceLanguage: string, nextTargetLanguage: string): Promise<void> {
    setSourceLanguage(nextSourceLanguage);
    setTargetLanguage(nextTargetLanguage);
    try {
      const result = parseOperationResult(await browser.runtime.sendMessage({
        type: 'SET_LANGUAGE_PREFERENCES', sourceLanguage: nextSourceLanguage, targetLanguage: nextTargetLanguage,
      } satisfies RuntimeMessage));
      if (!result.ok) throw new Error(result.message || '语言偏好保存失败');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '语言偏好保存失败');
    }
  }

  async function stop(): Promise<void> {
    setBusy(true);
    try {
      const rawResult: unknown = await browser.runtime.sendMessage({
        type: 'STOP_ACTIVE_TAB',
      } satisfies RuntimeMessage);
      const result = parseOperationResult(rawResult);
      setStatus(result.message || '已停止翻译');
      if (result.ok) setTranslationState({ state: 'stopped', hasRun: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '停止翻译失败');
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
      if (!result.ok) throw new Error(result.message || '切换显示模式失败');
      setStatus(result.message || '显示模式已切换');
    } catch (error) {
      setDisplayMode(previousMode);
      setStatus(error instanceof Error ? error.message : '切换显示模式失败');
    }
  }

  async function changeSelectionQuickAction(enabled: boolean): Promise<void> {
    if (!settings) return;
    setSettings({ ...settings, selectionQuickAction: enabled });
    try {
      const result = parseOperationResult(await browser.runtime.sendMessage({
        type: 'SET_SELECTION_QUICK_ACTION', enabled,
      } satisfies RuntimeMessage));
      if (!result.ok) throw new Error(result.message || '快捷翻译设置失败');
      await browser.runtime.sendMessage({
        type: 'CONFIGURE_SELECTION_QUICK_ACTION',
        enabled,
        sourceLanguage,
        targetLanguage,
        translationColor: settings.translationColor,
      } satisfies RuntimeMessage);
    } catch (error) {
      setSettings((current) => current ? { ...current, selectionQuickAction: !enabled } : current);
      setStatus(error instanceof Error ? error.message : '快捷翻译设置失败');
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
      if (!result.ok) throw new Error(result.message || '切换模型失败');
      setStatus(result.message || '模型已切换');
    } catch (error) {
      setSettings((current) => current ? { ...current, model: previousModel } : current);
      setStatus(error instanceof Error ? error.message : '切换模型失败');
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
          <Languages size={21} strokeWidth={2} />
        </div>
        <div>
          <h1>TextDuet</h1>
          <p>自己的模型，自己的阅读方式</p>
        </div>
      </header>

      <section className="control-card" aria-label="网页翻译控制">
        <LanguagePairPicker sourceLanguage={sourceLanguage} targetLanguage={targetLanguage} onChange={(source, target) => void changeLanguage(source, target)} compact />

        {modelOptions.length > 1 && (
          <label>
            <span>使用模型</span>
            <select value={settings?.model || ''} onChange={(event) => void changeModel(event.target.value)}>
              {modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
          </label>
        )}

        <button className="primary-button" type="button" onClick={toggleTranslation} disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" aria-hidden="true" size={16} strokeWidth={2} />
          ) : isTranslating ? (
            <Square aria-hidden="true" size={14} strokeWidth={2} />
          ) : (
            <Play aria-hidden="true" size={16} strokeWidth={2} />
          )}
          {settings?.hasApiKey
            ? busy
              ? '处理中…'
              : isTranslating
                ? '停止翻译'
                : '翻译当前网页'
            : '配置模型后开始'}
        </button>

        <div className="display-segments" aria-label="网页显示模式">
          <button
            type="button"
            aria-pressed={displayMode === 'bilingual'}
            disabled={!translationState.hasRun}
            onClick={() => void changeDisplayMode('bilingual')}
          >
            双语
          </button>
          <button
            type="button"
            aria-pressed={displayMode === 'source-only'}
            disabled={!translationState.hasRun}
            onClick={() => void changeDisplayMode('source-only')}
          >
            原文
          </button>
          <button
            type="button"
            aria-pressed={displayMode === 'translated-only'}
            disabled={!translationState.hasRun}
            onClick={() => void changeDisplayMode('translated-only')}
          >
            译文
          </button>
        </div>
        <label className="quick-action-toggle">
          <input type="checkbox" checked={settings?.selectionQuickAction === true} onChange={(event) => void changeSelectionQuickAction(event.target.checked)} />
          <span>选区快捷翻译图标</span>
        </label>
      </section>

      <section className="cost-card" aria-label="今日模型用量">
        <div className="cost-title">
          <span>
            <Activity aria-hidden="true" size={14} strokeWidth={2} />
            今日用量
          </span>
          {costDashboard?.today.hasEstimatedUsage && <small>含估算</small>}
        </div>
        {costDashboard ? (
          <>
            <strong>
              {(costDashboard.today.inputTokens + costDashboard.today.outputTokens)
                .toLocaleString('en-US')} token
            </strong>
            <p>
              输入 {costDashboard.today.inputTokens.toLocaleString('en-US')} · 输出{' '}
              {costDashboard.today.outputTokens.toLocaleString('en-US')}
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
                  {budgetStatusText(costDashboard.today.budgetPercentage)} · 达到 100% 仅提醒
                </span>
              </div>
            )}
            {!costDashboard.isLedgerAvailable && (
              <p className="ledger-warning">本地账本暂时不可用</p>
            )}
          </>
        ) : (
          <p>正在读取本地摘要…</p>
        )}
      </section>

      {status && (
        <p
          className={`td-badge ${
            /失败|错误|不能|不可|拒绝/.test(status)
              ? 'td-badge--danger'
              : /警告|注意|未配置|即将|接近/.test(status)
                ? 'td-badge--warning'
                : /成功|已|完成|切换/.test(status)
                  ? 'td-badge--success'
                  : 'td-badge--info'
          }`}
          role="status"
          aria-live="polite"
        >
          {status}
        </p>
      )}

      <footer>
        <span className={settings?.hasApiKey ? 'ready-dot' : 'idle-dot'} aria-hidden="true" />
        <span>{settings?.hasApiKey ? `${settings.model || '模型待配置'}` : '尚未配置 API Key'}</span>
        <button type="button" onClick={() => browser.runtime.openOptionsPage()}>
          <Settings aria-hidden="true" size={13} strokeWidth={2} />
          设置
        </button>
      </footer>
    </main>
  );
}

function budgetStatusText(percentage: number): string {
  if (percentage >= 100) return `已达到预算 · ${percentage.toFixed(0)}%`;
  if (percentage >= 80) return `接近预算 · ${percentage.toFixed(0)}%`;
  if (percentage >= 50) return `已使用一半 · ${percentage.toFixed(0)}%`;
  return `预算已用 ${percentage.toFixed(0)}%`;
}
