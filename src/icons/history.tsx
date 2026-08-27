import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 历史(逆时针回旋)
 */
export function HistoryIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
