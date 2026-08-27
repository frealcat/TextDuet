import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 加号
 */
export function PlusIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
