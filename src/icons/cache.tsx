import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 缓存(数据库 + 闪电)
 */
export function CacheIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <ellipse cx="12" cy="5" rx="7" ry="2" />
      <path d="M5 5v5c0 1.1 3.1 2 7 2s7-.9 7-2V5" />
      <path d="M5 10v5c0 1.1 3.1 2 7 2s7-.9 7-2v-5" />
      <path d="M13 13l-2 3h3l-2 3" strokeWidth={1.5} />
    </svg>
  );
}
