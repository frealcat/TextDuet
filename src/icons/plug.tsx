import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 插头 / 连接
 */
export function PlugIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M9 3v4M15 3v4" />
      <rect x="6" y="7" width="12" height="6" rx="2" />
      <path d="M12 13v3a4 4 0 0 1-4 4H7" />
    </svg>
  );
}
