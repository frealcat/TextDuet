import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 减号
 */
export function MinusIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M5 12h14" />
    </svg>
  );
}
