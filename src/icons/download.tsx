import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 下载(箭头入箱)
 */
export function DownloadIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M12 4v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </svg>
  );
}
