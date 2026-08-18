import * as RadioGroup from '@radix-ui/react-radio-group';
import { HardDrive, ShieldCheck } from 'lucide-react';
import type { ApiKeyPersistence } from '@/src/core/contracts';

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
          <ShieldCheck size={18} strokeWidth={2} />
        </span>
        <span className="radio-copy">
          <strong>仅本次浏览器会话</strong>
          <small>推荐。关闭浏览器后自动清除，需要下次重新输入。</small>
        </span>
        <span className="radio-control" aria-hidden="true">
          <RadioGroup.Indicator className="radio-indicator" />
        </span>
      </RadioGroup.Item>
      <RadioGroup.Item className="radio-card" value="local" type="button">
        <span className="choice-icon" aria-hidden="true">
          <HardDrive size={18} strokeWidth={2} />
        </span>
        <span className="radio-copy">
          <strong>持久保存在本机</strong>
          <small>使用更方便，但浏览器扩展本地存储并不是加密保险箱。</small>
        </span>
        <span className="radio-control" aria-hidden="true">
          <RadioGroup.Indicator className="radio-indicator" />
        </span>
      </RadioGroup.Item>
    </RadioGroup.Root>
  );
}
