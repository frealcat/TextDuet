import { ChevronDownIcon, PaletteIcon } from '@/src/icons';
import type { TranslationDisplayMode } from '@/src/core/contracts';
import { DEFAULT_TRANSLATION_COLOR } from '@/src/core/defaults';
import { isSupportedTranslationColor } from '@/src/core/translation-colors';
import { t } from '@/src/i18n';

interface TranslationAppearanceControlsProps {
  displayMode: TranslationDisplayMode;
  translationColor: string;
  disabled: boolean;
  onDisplayModeChange: (value: TranslationDisplayMode) => void;
  onTranslationColorChange: (value: string) => void;
}

export function TranslationAppearanceControls({
  displayMode,
  translationColor,
  disabled,
  onDisplayModeChange,
  onTranslationColorChange,
}: TranslationAppearanceControlsProps) {
  const isColorValid = isSupportedTranslationColor(translationColor);

  return (
    <div className="appearance-controls" aria-label={t('阅读显示设置')}>
      <label className="select-field">
        <span>{t('appearance.displayMode.label')}</span>
        <select
          value={displayMode}
          disabled={disabled}
          onChange={(event) => onDisplayModeChange(event.target.value as TranslationDisplayMode)}
        >
          <option value="bilingual">{t('appearance.displayMode.bilingual')}</option>
          <option value="source-only">{t('appearance.displayMode.sourceOnly')}</option>
          <option value="translated-only">{t('appearance.displayMode.translatedOnly')}</option>
        </select>
      </label>

      <details className="color-picker">
        <summary>
          <span
            className="color-swatch"
            style={{ backgroundColor: isColorValid ? translationColor : DEFAULT_TRANSLATION_COLOR }}
            aria-hidden="true"
          />
          <span>
            <strong>{t('appearance.translationColor.label')}</strong>
            <small>{translationColor || DEFAULT_TRANSLATION_COLOR}</small>
          </span>
          <ChevronDownIcon size={16} />
        </summary>
        <div className="color-picker-panel">
          <label className="native-color-field">
            <span><PaletteIcon size={14} /> 取色盘</span>
            <input
              type="color"
              value={toNativeColor(translationColor)}
              disabled={disabled}
              onChange={(event) => onTranslationColorChange(event.target.value)}
            />
          </label>
          <label>
            <span>{t('appearance.translationColor.inputLabel')}</span>
            <input
              value={translationColor}
              disabled={disabled}
              aria-invalid={!isColorValid}
              placeholder={t('#9c5e2e 或 rgba(156, 94, 46, 0.9)')}
              spellCheck={false}
              onChange={(event) => onTranslationColorChange(event.target.value)}
            />
          </label>
          {!isColorValid && (
            <small className="field-error">{t('appearance.translationColor.invalid')}</small>
          )}
        </div>
      </details>
    </div>
  );
}

function toNativeColor(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (/^#[\da-f]{6}(?:[\da-f]{2})?$/.test(normalized)) return normalized.slice(0, 7);
  if (/^#[\da-f]{3,4}$/.test(normalized)) {
    return `#${normalized.slice(1, 4).split('').map((digit) => digit + digit).join('')}`;
  }
  const channels = normalized.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  if (!channels) return DEFAULT_TRANSLATION_COLOR;
  return `#${channels.slice(1, 4).map((channel) => Math.min(Number(channel), 255).toString(16).padStart(2, '0')).join('')}`;
}
