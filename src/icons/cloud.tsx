import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 云
 */
export function CloudIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M7 18a4 4 0 0 1-1-7.9A6 6 0 0 1 18 9a4 4 0 0 1-1 7.9z" />
    </svg>
  );
}
