import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 排序:三行长度递减 + 圆点
 */
export function SortIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M4 6h13" />
      <path d="M4 12h9" />
      <path d="M4 18h5" />
      <circle cx="20" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
