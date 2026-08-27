import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 钥匙 / API Key
 */
export function KeyIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <circle cx="8" cy="14" r="4" />
      <path d="M11 11l9-9" />
      <path d="M16 6l3 3" />
      <path d="M19 3l2 2" />
    </svg>
  );
}
