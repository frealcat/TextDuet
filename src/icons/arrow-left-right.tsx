import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 左右箭头(交换 / 双向)
 */
export function ArrowLeftRightIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M3 8h16" />
      <path d="M16 4l4 4-4 4" />
      <path d="M21 16H5" />
      <path d="M8 12l-4 4 4 4" />
    </svg>
  );
}
