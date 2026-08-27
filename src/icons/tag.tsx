import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 标签 / 价签
 */
export function TagIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M3 12.5V5a2 2 0 0 1 2-2h7.5L20 12.5 12.5 20z" />
      <circle cx="8" cy="8" r="1.2" />
    </svg>
  );
}
