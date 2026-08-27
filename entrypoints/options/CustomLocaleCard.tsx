import { useEffect, useMemo, useState } from 'react';
import { CircleCheckIcon, DownloadIcon, TranslationIcon, RefreshIcon, TrashIcon } from '@/src/icons';
import type { I18nBatchTranslationResult, RuntimeMessage } from '@/src/core/contracts';
import { parseI18nBatchTranslationResult } from '@/src/core/schemas';
import { useTranslation } from '@/src/i18n';
import {
  clearAllUserLocales,
  clearUserLocale,
  listUserLocales,
  loadAllUserLocales,
  translateUiTo,
  type UserLocaleRecord,
  type Fetcher,
} from '@/src/i18n';

interface CustomLocaleCardProps {
  /** BCP-47 tag of the user's current language preference. */
  currentLanguagePreference: string;
  /** Show progress / errors tied to the current language choice. */
  onLocaleChange: (tag: string) => void;
  /** Optional DOM id, used by sidebar scroll anchors (TD-2026-025 P2). */
  id?: string;
}

const COMMON_LOCALE_PRESETS: { tag: string; name: string }[] = [
  { tag: 'ja-JP', name: '日本語' },
  { tag: 'fr-FR', name: 'Français' },
  { tag: 'de-DE', name: 'Deutsch' },
  { tag: 'ko-KR', name: '한국어' },
  { tag: 'zh-TW', name: '繁體中文' },
  { tag: 'es-ES', name: 'Español' },
  { tag: 'pt-BR', name: 'Português (Brasil)' },
  { tag: 'ru-RU', name: 'Русский' },
  { tag: 'it-IT', name: 'Italiano' },
  { tag: 'th-TH', name: 'ไทย' },
];

export function CustomLocaleCard({ currentLanguagePreference, onLocaleChange, id }: CustomLocaleCardProps) {
  const { t } = useTranslation();
  const [records, setRecords] = useState<UserLocaleRecord[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [customTag, setCustomTag] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void loadAllUserLocales().then(() => setRecords(listUserLocales()));
  }, []);

  const builtInActive = currentLanguagePreference === 'auto' || currentLanguagePreference === 'zh-CN' || currentLanguagePreference === 'en';

  const orderedPresets = useMemo(
    () => COMMON_LOCALE_PRESETS.filter((p) => !records.some((r) => r.tag === p.tag)),
    [records],
  );

  async function translateTo(tag: string, displayName: string): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError('');
    setProgress(`正在翻译到 ${displayName}…`);

    const fetcher: Fetcher = async (targetTag, targetLocale, sourceBatch) => {
      const raw: unknown = await browser.runtime.sendMessage({
        type: 'TRANSLATE_I18N_BATCH',
        targetTag,
        targetLocale,
        sourceBatch,
      } satisfies RuntimeMessage);
      return parseI18nBatchTranslationResult(raw);
    };

    try {
      const result = await translateUiTo(tag as never, {
        fetcher,
        displayName,
        onProgress: (p) => setProgress(p.message),
      });
      if (!result.ok) {
        setError(result.errorMessage);
        return;
      }
      setRecords(listUserLocales());
      onLocaleChange(tag);
      setProgress(`已翻译到 ${displayName}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '翻译失败');
    } finally {
      setBusy(false);
    }
  }

  async function handleTranslateCustom(): Promise<void> {
    const tag = customTag.trim();
    if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/.test(tag)) {
      setError('请输入合法的 BCP-47 标签，例如 fr-FR / ja-JP');
      return;
    }
    await translateTo(tag, tag);
  }

  async function handleRetranslate(record: UserLocaleRecord): Promise<void> {
    await clearUserLocale(record.tag);
    setRecords(listUserLocales());
    await translateTo(record.tag, record.tag);
  }

  async function handleRemove(tag: string): Promise<void> {
    await clearUserLocale(tag);
    setRecords(listUserLocales());
  }

  async function handleClearAll(): Promise<void> {
    if (!confirm(t('language.custom.confirmClearAll'))) return;
    await clearAllUserLocales();
    setRecords([]);
  }

  return (
    <section id={id} className="settings-card" aria-labelledby="custom-locale-heading">
      <div className="section-heading">
        <div>
          <span className="step">06</span>
          <h2 id="custom-locale-heading">{t('language.custom.title')}</h2>
        </div>
        <span className="optional">{t('language.custom.optional')}</span>
      </div>

      <p className="field-hint">{t('language.custom.description')}</p>

      <div className="custom-locale-presets">
        {orderedPresets.map((preset) => (
          <button
            key={preset.tag}
            type="button"
            className="preset"
            disabled={busy}
            onClick={() => void translateTo(preset.tag, preset.name)}
          >
            <span className="custom-locale-name">{preset.name}</span>
            <span className="custom-locale-tag">{preset.tag}</span>
            <DownloadIcon size={14} />
          </button>
        ))}
        {orderedPresets.length === 0 && (
          <p className="field-hint">{t('language.custom.allDownloaded')}</p>
        )}
      </div>

      <fieldset className="custom-locale-input-row">
        <label>
          <span>{t('language.custom.inputLabel')}</span>
          <input
            type="text"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            placeholder="例如：fr-FR / ja-JP / zh-TW"
            spellCheck={false}
            disabled={busy}
          />
        </label>
        <button
          type="button"
          className="primary-button"
          disabled={busy || !customTag.trim()}
          onClick={() => void handleTranslateCustom()}
        >
          <TranslationIcon size={16} />
          {t('language.custom.translateButton')}
        </button>
      </fieldset>

      {progress && (
        <p className="field-hint custom-locale-progress" role="status" aria-live="polite">
          {progress}
        </p>
      )}
      {error && (
        <p className="td-badge td-badge--danger" role="alert">{error}</p>
      )}
      {builtInActive && records.length === 0 && !busy && !progress && !error && (
        <p className="field-hint">{t('language.custom.empty')}</p>
      )}

      {records.length > 0 && (
        <ul className="custom-locale-list" aria-label={t('language.custom.listTitle')}>
          {records.map((record) => (
            <li key={record.tag} className="custom-locale-row">
              <div className="custom-locale-row-meta">
                <strong>{record.tag}</strong>
                <span>
                  {record.entryCount} {t('language.custom.entriesUnit')} · {record.sourceModel}
                </span>
                <small>
                  {new Date(record.translatedAt).toLocaleString()}
                </small>
              </div>
              <div className="custom-locale-row-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => void handleRetranslate(record)}
                  title={t('language.custom.retranslate')}
                >
                  <RefreshIcon size={14} />
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => void handleRemove(record.tag)}
                  title={t('language.custom.remove')}
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {records.length > 1 && (
        <div className="card-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => void handleClearAll()}
          >
            <TrashIcon size={14} />
            {t('language.custom.clearAll')}
          </button>
        </div>
      )}

      {!builtInActive && !records.some((r) => r.tag === currentLanguagePreference) && (
        <p className="td-badge td-badge--warning" role="status">
          <CircleCheckIcon size={14} />
          {t('language.custom.translatePrompt')}
        </p>
      )}
    </section>
  );
}
