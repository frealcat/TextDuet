import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 柱状图(预算)
 */
export function ChartBarIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M3 3v18h18" />
      <rect x="6" y="13" width="3" height="5" />
      <rect x="11" y="9" width="3" height="9" />
      <rect x="16" y="6" width="3" height="12" />
    </svg>
  );
}
