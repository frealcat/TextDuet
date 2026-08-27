import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 上箭头
 */
export function ArrowUpIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </svg>
  );
}
