import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 雪佛龙下
 */
export function ChevronDownIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
