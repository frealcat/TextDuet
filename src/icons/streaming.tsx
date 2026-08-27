import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 流式输出:三条递减的弧线 + 一个圆点
 * 表达"逐段到达"
 */
export function StreamingIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <circle cx="6" cy="12" r="1.5" />
      <path d="M11 12h9" />
      <path d="M11 7c2 0 4 1.5 4 5s-2 5-4 5" />
      <path d="M11 17c4 0 7-2 7-5s-3-5-7-5" />
    </svg>
  );
}
