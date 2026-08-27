import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 钱币 / 预算成本
 */
export function CoinIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9h5a2 2 0 0 1 0 4h-4M11 13v4" />
      <path d="M15 9l-1-2" />
    </svg>
  );
}
