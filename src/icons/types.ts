/**
 * TextDuet 手设计 SVG 图标套件(TD-2026-025 P3)
 *
 * 设计原则:
 * - 24×24 viewBox,1.5px stroke,currentColor 单色
 * - monoline,无填充,几何 + 编辑感(warm-craft 家族)
 * - 圆角端点 + 圆角拐角
 * - 视觉权重统一,语义清晰,跨语言可识别
 *
 * 使用方式:
 *   import { Icon } from '@/src/icons';
 *   <Icon name="translation" size={20} />
 *
 * 单文件直接 import(避免打包整个目录):
 *   import { TranslationIcon } from '@/src/icons/translation';
 */

import type { SVGProps } from 'react';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children' | 'viewBox'> {
  /** 图标尺寸,对应 --td-icon-{n} token;默认 24 */
  size?: 12 | 14 | 16 | 20 | 24 | 32 | 40;
  /** 描述文本,无障碍读屏 */
  title?: string;
}

/** 共享 SVG 内部属性:24×24,1.5px stroke,圆角端点 */
export const baseSvgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};
