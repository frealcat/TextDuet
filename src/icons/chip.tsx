import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 芯片 / 模型
 */
export function ChipIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="0.5" />
      <path d="M9 3v3M12 3v3M15 3v3" />
      <path d="M9 18v3M12 18v3M15 18v3" />
      <path d="M3 9h3M3 12h3M3 15h3" />
      <path d="M18 9h3M18 12h3M18 15h3" />
    </svg>
  );
}
