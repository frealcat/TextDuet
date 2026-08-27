import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 对勾
 */
export function CheckIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
