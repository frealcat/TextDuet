import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 播放 / 开始(三角形)
 */
export function PlayIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M7 5l12 7-12 7z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />
    </svg>
  );
}
