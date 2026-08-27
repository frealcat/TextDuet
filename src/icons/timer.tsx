import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 计时器(沙漏)
 */
export function TimerIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M5 3h14" />
      <path d="M7 3l5 7-5 7v4h10v-4l-5-7 5-7" />
    </svg>
  );
}
