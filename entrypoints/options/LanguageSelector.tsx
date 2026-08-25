import * as RadioGroup from '@radix-ui/react-radio-group';
import { Globe } from 'lucide-react';
import type { LanguagePreference } from '@/src/i18n';
import { t } from '@/src/i18n';

interface LanguageSelectorProps {
  value: LanguagePreference;
  disabled: boolean;
  onChange: (value: LanguagePreference) => void;
}

/**
 * Loosely validate an IETF BCP-47 tag. Matches `auto` and any tag of
 * the form `xx` or `xx-YYYY` where xx is letters and YYYY is letters
 * / digits / hyphens (region, script, variant). Same regex used in
 * the schema validator so the UI can pre-empt the schema error.
 */
function isValidLocaleTag(value: string): boolean {
  if (value === 'auto') return true;
  return /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/.test(value);
}

/**
 * Renders the accessible language selector as a controlled radio group.
 *
 * Sits as the FIRST card on the Options page (per TD-2026-023 spec) and
 * lets the user pin the locale or follow the browser default. The
 * "Custom…" entry lets the user type any BCP-47 tag (e.g. ja-JP) —
 * selecting it kicks off the user-locale translation flow
 * (TD-2026-024).
 */
export function LanguageSelector({
  value,
  disabled,
  onChange,
}: LanguageSelectorProps) {
  return (
    <RadioGroup.Root
      className="language-selector"
      value={value}
      onValueChange={(nextValue) => {
        if (!isValidLocaleTag(nextValue)) return;
        onChange(nextValue as LanguagePreference);
      }}
      disabled={disabled}
    >
      <RadioGroup.Item className="radio-card" value="auto" type="button">
        <span className="choice-icon" aria-hidden="true">
          <Globe size={18} strokeWidth={2} />
        </span>
        <span className="radio-copy">
          <strong>{t('language.option.auto.label')}</strong>
          <small>{t('language.option.auto.description')}</small>
        </span>
        <span className="radio-control" aria-hidden="true">
          <RadioGroup.Indicator className="radio-indicator" />
        </span>
      </RadioGroup.Item>
      <RadioGroup.Item className="radio-card" value="zh-CN" type="button">
        <span className="choice-icon" aria-hidden="true" lang="zh-CN">
          中
        </span>
        <span className="radio-copy">
          <strong>{t('language.option.zh-CN.label')}</strong>
          <small>{t('language.option.zh-CN.description')}</small>
        </span>
        <span className="radio-control" aria-hidden="true">
          <RadioGroup.Indicator className="radio-indicator" />
        </span>
      </RadioGroup.Item>
      <RadioGroup.Item className="radio-card" value="en" type="button">
        <span className="choice-icon" aria-hidden="true" lang="en">
          EN
        </span>
        <span className="radio-copy">
          <strong>{t('language.option.en.label')}</strong>
          <small>{t('language.option.en.description')}</small>
        </span>
        <span className="radio-control" aria-hidden="true">
          <RadioGroup.Indicator className="radio-indicator" />
        </span>
      </RadioGroup.Item>
    </RadioGroup.Root>
  );
}
