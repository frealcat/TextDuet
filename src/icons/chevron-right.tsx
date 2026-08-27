import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 雪佛龙右(轻箭头)
 */
export function ChevronRightIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
