import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 错误(圈 + 叉)
 */
export function CircleXIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6" />
      <path d="M15 9l-6 6" />
    </svg>
  );
}
