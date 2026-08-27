import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 菜单 / 汉堡(三横线)
 */
export function MenuIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </svg>
  );
}
