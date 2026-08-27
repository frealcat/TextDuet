import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * TextDuet 品牌 mark:叠放 "T / t" 双语标识(沿用 v1.0 扩展图标设计语言)
 * 暖纸底 + 粗体赤陶 T + 下方赭石小 t
 */
export function TextDuetMarkIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      {/* 大 T:横 + 竖,赤陶色(通过 currentColor 继承) */}
      <path d="M5 7h14" strokeWidth={2.5} />
      <path d="M12 7v12" strokeWidth={2.5} />
      {/* 小 t:横 + 竖 + 弯钩,赭石色弱化 */}
      <path d="M9 18h4" />
      <path d="M11 18v3" />
    </svg>
  );
}
