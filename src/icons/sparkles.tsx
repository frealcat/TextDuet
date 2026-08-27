import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 闪光 / AI 增强
 */
export function SparklesIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M12 3l1.5 4 4 1.5-4 1.5L12 14l-1.5-4-4-1.5 4-1.5z" />
      <path d="M19 14l.75 2 2 .75-2 .75L19 19.5l-.75-2-2-.75 2-.75z" />
      <path d="M5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5z" />
    </svg>
  );
}
