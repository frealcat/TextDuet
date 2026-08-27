import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 数据库(圆柱)
 */
export function DatabaseIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <ellipse cx="12" cy="5" rx="8" ry="2.5" />
      <path d="M4 5v6c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V5" />
      <path d="M4 11v6c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-6" />
    </svg>
  );
}
