import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 阅读:翻开的书,中央折痕,左右两页
 */
export function ReadingIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M3 5.5c2.5-1 5-1 8.5 0v13c-3.5-1-6-1-8.5 0z" />
      <path d="M21 5.5c-2.5-1-5-1-8.5 0v13c3.5-1 6-1 8.5 0z" />
      <path d="M7 9h3M7 12h3" />
      <path d="M14 9h3M14 12h3" />
    </svg>
  );
}
