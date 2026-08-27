import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 双语:上下两行,每行一个字符位(模拟 AB / 对照)
 * A 在上,B 在下,中间一条分隔
 */
export function BilingualIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M4 12h16" />
      <path d="M9 7.5h2M10 7.5v3M9 9.5h2" />
      <path d="M14 7.5h2M15 7.5v3M14 9.5h2" />
      <path d="M9 16.5h2M10 16.5v3M9 18.5h2" />
      <path d="M14 16.5h2M15 16.5v3M14 18.5h2" />
    </svg>
  );
}
