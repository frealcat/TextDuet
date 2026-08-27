import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 折线图(用量)
 */
export function ChartLineIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 3 3 5-6" />
      <circle cx="11" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="13" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
