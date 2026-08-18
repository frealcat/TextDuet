import { ChevronDown, Palette } from 'lucide-react';
import type { TranslationDisplayMode } from '@/src/core/contracts';
import { DEFAULT_TRANSLATION_COLOR } from '@/src/core/defaults';
import { isSupportedTranslationColor } from '@/src/core/translation-colors';

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
    <div className="appearance-controls">
      <label className="select-field">
        <span>默认显示方式</span>
        <select
          value={displayMode}
          disabled={disabled}
          onChange={(event) => onDisplayModeChange(event.target.value as TranslationDisplayMode)}
        >
          <option value="bilingual">显示原文与译文</option>
          <option value="source-only">只显示原文</option>
          <option value="translated-only">只显示译文</option>
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
            <strong>译文文字颜色</strong>
            <small>{translationColor || DEFAULT_TRANSLATION_COLOR}</small>
          </span>
          <ChevronDown aria-hidden="true" size={15} strokeWidth={2} />
        </summary>
        <div className="color-picker-panel">
          <label className="native-color-field">
            <span><Palette aria-hidden="true" size={14} strokeWidth={2} /> 取色盘</span>
            <input
              type="color"
              value={toNativeColor(translationColor)}
              disabled={disabled}
              onChange={(event) => onTranslationColorChange(event.target.value)}
            />
          </label>
          <label>
            <span>RGBA 或 # 十六进制</span>
            <input
              value={translationColor}
              disabled={disabled}
              aria-invalid={!isColorValid}
              placeholder="#147d64 或 rgba(20, 125, 100, 0.9)"
              spellCheck={false}
              onChange={(event) => onTranslationColorChange(event.target.value)}
            />
          </label>
          {!isColorValid && (
            <small className="field-error">请输入有效的 #RGB、#RRGGBB、#RRGGBBAA、rgb() 或 rgba()。</small>
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
