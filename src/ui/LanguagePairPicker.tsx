import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { SUPPORTED_SOURCE_LANGUAGES, SUPPORTED_TARGET_LANGUAGES, DEFAULT_TARGET_LANGUAGE, resolveSystemLanguage } from '@/src/core/defaults';

interface LanguagePairPickerProps {
  sourceLanguage: string;
  targetLanguage: string;
  onChange: (sourceLanguage: string, targetLanguage: string) => void;
  compact?: boolean;
}

export function LanguagePairPicker({ sourceLanguage, targetLanguage, onChange, compact = false }: LanguagePairPickerProps) {
  return (
    <div className={compact ? 'language-pair language-pair-compact' : 'language-pair'} aria-label="语言方向">
      <LanguageMenu label="当前语言" value={sourceLanguage} options={SUPPORTED_SOURCE_LANGUAGES} onChange={(value) => onChange(value, targetLanguage)} />
      <span className="language-pair-arrow" aria-hidden="true">→</span>
      <LanguageMenu label="翻译到" value={targetLanguage} options={[{ value: DEFAULT_TARGET_LANGUAGE, label: `跟随系统（${resolveSystemLanguage()}）` }, ...SUPPORTED_TARGET_LANGUAGES]} onChange={(value) => onChange(sourceLanguage, value)} />
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
        <span>{current?.label || value}</span><ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && <div className="language-menu-popover" role="listbox" aria-label={label}>
        {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false); }}><span>{option.label}</span>{option.value === value && <Check size={14} aria-hidden="true" />}</button>)}
      </div>}
    </div>
  );
}
