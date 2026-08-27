import * as RadioGroup from '@radix-ui/react-radio-group';
import { DatabaseIcon, ShieldCheckIcon } from '@/src/icons';
import type { ApiKeyPersistence } from '@/src/core/contracts';
import { t } from '@/src/i18n';

interface PersistenceOptionsProps {
  value: ApiKeyPersistence;
  disabled: boolean;
  onChange: (value: ApiKeyPersistence) => void;
}

/** Renders the accessible API Key persistence choice as a controlled radio group. */
export function PersistenceOptions({
  value,
  disabled,
  onChange,
}: PersistenceOptionsProps) {
  return (
    <RadioGroup.Root
      className="persistence-options"
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue === 'session' || nextValue === 'local') {
          onChange(nextValue);
        }
      }}
      disabled={disabled}
    >
      <RadioGroup.Item className="radio-card" value="session" type="button">
        <span className="choice-icon" aria-hidden="true">
          <ShieldCheckIcon size={20} />
        </span>
        <span className="radio-copy">
          <strong>{t('persistence.session.title')}</strong>
          <small>{t('persistence.session.description')}</small>
        </span>
        <span className="radio-control" aria-hidden="true">
          <RadioGroup.Indicator className="radio-indicator" />
        </span>
      </RadioGroup.Item>
      <RadioGroup.Item className="radio-card" value="local" type="button">
        <span className="choice-icon" aria-hidden="true">
          <DatabaseIcon size={20} />
        </span>
        <span className="radio-copy">
          <strong>{t('persistence.local.title')}</strong>
          <small>{t('persistence.local.description')}</small>
        </span>
        <span className="radio-control" aria-hidden="true">
          <RadioGroup.Indicator className="radio-indicator" />
        </span>
      </RadioGroup.Item>
    </RadioGroup.Root>
  );
}
