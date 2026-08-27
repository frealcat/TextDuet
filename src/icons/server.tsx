import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 服务 / 服务器:堆叠的机架单元
 */
export function ServerIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <rect x="3" y="4" width="18" height="6" rx="1.5" />
      <rect x="3" y="14" width="18" height="6" rx="1.5" />
      <path d="M7 7h.01M7 17h.01" strokeWidth={2} />
      <path d="M11 7h6M11 17h6" />
    </svg>
  );
}
