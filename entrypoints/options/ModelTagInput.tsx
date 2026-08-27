import { useState, type KeyboardEvent } from 'react';
import { CheckIcon, CloseIcon } from '@/src/icons';
import { t } from '@/src/i18n';

const MAX_MODELS = 50;

interface ModelTagInputProps {
  models: readonly string[];
  activeModel: string;
  placeholder: string;
  disabled: boolean;
  onModelsChange: (models: string[]) => void;
  onActiveModelChange: (model: string) => void;
}

export function ModelTagInput({
  models,
  activeModel,
  placeholder,
  disabled,
  onModelsChange,
  onActiveModelChange,
}: ModelTagInputProps) {
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState('');

  function addDraft(): void {
    const model = draft.trim();
    if (!model) return;
    if (models.includes(model)) {
      onActiveModelChange(model);
      setDraft('');
      setFeedback(`已切换到 ${model}`);
      return;
    }
    if (models.length >= MAX_MODELS) {
      setFeedback(`最多可配置 ${MAX_MODELS} 个模型`);
      return;
    }
    onModelsChange([...models, model]);
    onActiveModelChange(model);
    setDraft('');
    setFeedback(`已添加并选中 ${model}`);
  }

  function removeModel(model: string): void {
    const nextModels = models.filter((item) => item !== model);
    onModelsChange(nextModels);
    if (activeModel === model) onActiveModelChange(nextModels[0] || '');
    setFeedback(`已移除 ${model}`);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addDraft();
      return;
    }
    if (event.key === 'Backspace' && !draft && models.length > 0) {
      const lastModel = models.at(-1);
      if (lastModel) removeModel(lastModel);
    }
  }

  return (
    <div className="model-tag-field">
      <span className="field-label">{t('modelTag.fieldLabel')}</span>
      <div className="model-tag-input" data-disabled={disabled || undefined}>
        {models.map((model) => (
          <span className={model === activeModel ? 'model-tag active' : 'model-tag'} key={model}>
            <button
              className="model-tag-select"
              type="button"
              disabled={disabled}
              aria-pressed={model === activeModel}
              onClick={() => onActiveModelChange(model)}
            >
              {model === activeModel && <CheckIcon size={12} strokeWidth={2.5} />}
              <span>{model}</span>
              {model === activeModel && <small>{t('modelTag.tag.current')}</small>}
            </button>
            <button
              className="model-tag-remove"
              type="button"
              disabled={disabled}
              aria-label={`删除模型 ${model}`}
              title={`删除 ${model}`}
              onClick={() => removeModel(model)}
            >
              <CloseIcon size={14} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          disabled={disabled}
          maxLength={256}
          aria-label={t('添加模型名称或 code')}
          placeholder={models.length === 0 ? placeholder : '输入后按回车添加'}
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value.replace(/,$/, ''))}
          onKeyDown={handleKeyDown}
          onBlur={addDraft}
        />
      </div>
      <small>{t('modelTag.hint')}</small>
      <span className="sr-only" aria-live="polite">{feedback}</span>
    </div>
  );
}
