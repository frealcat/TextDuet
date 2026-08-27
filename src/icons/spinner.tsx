import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * Spinner(加载中,使用 CSS .spin 动画旋转)
 * 替代 lucide-react 的 LoaderCircle
 */
export function SpinnerIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M12 4a8 8 0 0 1 8 8" />
      <path d="M4 12a8 8 0 0 0 4 6.9" opacity={0.4} />
    </svg>
  );
}
