import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 成功(圈 + 对勾)
 */
export function CircleCheckIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </svg>
  );
}
