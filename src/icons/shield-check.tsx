import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 盾牌 + 对勾(API Key 安全)
 */
export function ShieldCheckIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
