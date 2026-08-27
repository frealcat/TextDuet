import type { IconProps } from './types';
import { baseSvgProps } from './types';

/**
 * 翻译:左右两个气泡(原文/译文),中间连一条斜线
 * 表达"双语对照"
 */
export function TranslationIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} {...baseSvgProps} {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7l-3 2v-2H5a2 2 0 0 1-2-2z" />
      <path d="M21 13a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2l3 2v-2h-1a2 2 0 0 0 2-2z" />
      <path d="M9 11l3-3M12 8h-3M9 11l-1 2" strokeWidth={1.2} />
      <path d="M15 17l-3-3M12 14h3M15 17l1 2" strokeWidth={1.2} />
    </svg>
  );
}
