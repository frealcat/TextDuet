import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 列表:三条横线 + 圆点
 */
export function ListIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <circle cx="5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="1" fill="currentColor" stroke="none" />
      <path d="M9 6h12" />
      <path d="M9 12h12" />
      <path d="M9 18h12" />
    </svg>
  );
}
