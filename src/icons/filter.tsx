import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 筛选:漏斗
 */
export function FilterIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M3 5h18l-7 8v6l-4-2v-4z" />
    </svg>
  );
}
