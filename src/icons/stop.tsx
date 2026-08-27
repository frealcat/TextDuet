import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 停止(方块)
 */
export function StopIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  );
}
