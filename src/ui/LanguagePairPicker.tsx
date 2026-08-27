import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRightIcon, CheckIcon, ChevronDownIcon } from '@/src/icons';
import { SUPPORTED_SOURCE_LANGUAGES, SUPPORTED_TARGET_LANGUAGES, DEFAULT_TARGET_LANGUAGE, resolveSystemLanguage } from '@/src/core/defaults';
import { t } from '@/src/i18n';

interface LanguagePairPickerProps {
  sourceLanguage: string;
  targetLanguage: string;
  onChange: (sourceLanguage: string, targetLanguage: string) => void;
  compact?: boolean;
}

export function LanguagePairPicker({ sourceLanguage, targetLanguage, onChange, compact = false }: LanguagePairPickerProps) {
  // 防止「目标语言 = 跟随系统」时,swap 到源语言后变成无效值
  // 跟随系统本身是 sentinel,不能作为 sourceLanguage 使用
  function handleSwap(): void {
    if (targetLanguage === DEFAULT_TARGET_LANGUAGE) {
      // 跟随系统不能 swap 到源:保持当前 source,让用户手动选
      return;
    }
    onChange(targetLanguage, sourceLanguage);
  }

  const canSwap = targetLanguage !== DEFAULT_TARGET_LANGUAGE;

  return (
    <div className={compact ? 'language-pair language-pair-compact' : 'language-pair'} aria-label={t('languagePair.aria')}>
      <LanguageMenu
        label={t('languagePair.sourceLabel')}
        value={sourceLanguage}
        options={SUPPORTED_SOURCE_LANGUAGES}
        onChange={(value) => onChange(value, targetLanguage)}
      />
      <button
        type="button"
        className="language-pair-swap"
        aria-label={t('languagePair.swapTitle')}
        title={t('languagePair.swapTitle')}
        disabled={!canSwap}
        onClick={handleSwap}
      >
        <ArrowLeftRightIcon size={16} />
      </button>
      <LanguageMenu
        label={t('languagePair.targetLabel')}
        value={targetLanguage}
        options={[
          { value: DEFAULT_TARGET_LANGUAGE, label: t('languagePair.followSystem', { language: resolveSystemLanguage() }) },
          ...SUPPORTED_TARGET_LANGUAGES,
        ]}
        onChange={(value) => onChange(sourceLanguage, value)}
      />
    </div>
  );
}

function LanguageMenu({ label, value, options, onChange }: { label: string; value: string; options: readonly { value: string; label: string }[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value) || options[0];
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [open]);
  return (
    <div className="language-menu" ref={rootRef}>
      <span className="language-menu-label">{label}</span>
      <button type="button" className="language-menu-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((currentOpen) => !currentOpen)}>
        <span>{current?.label || value}</span><ChevronDownIcon size={14} />
      </button>
      {open && <div className="language-menu-popover" role="listbox" aria-label={label}>
        {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false); }}><span>{option.label}</span>{option.value === value && <CheckIcon size={14} />}</button>)}
      </div>}
    </div>
  );
}
