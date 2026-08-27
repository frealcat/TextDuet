import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 删除 / 垃圾桶
 */
export function TrashIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M4 7h16" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M9 7V4h6v3" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
