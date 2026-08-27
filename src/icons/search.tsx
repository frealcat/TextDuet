import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 搜索:放大镜
 */
export function SearchIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5L20 20" />
    </svg>
  );
}
