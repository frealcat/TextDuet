import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 保存(软盘)
 */
export function SaveIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M5 3h11l3 3v15H5z" />
      <path d="M8 3v6h7V3" />
      <path d="M8 14h8v7H8z" />
    </svg>
  );
}
