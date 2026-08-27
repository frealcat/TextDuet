import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 下箭头
 */
export function ArrowDownIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M12 5v14" />
      <path d="M6 13l6 6 6-6" />
    </svg>
  );
}
