import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 关闭 / 叉
 */
export function CloseIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}
