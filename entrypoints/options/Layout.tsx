import type { ReactNode } from 'react';
import { Sidebar, type SidebarSection } from './Sidebar';

interface OptionsLayoutProps {
  /** 4 段配置,用于 sidebar 导航 */
  sections: SidebarSection[];
  /** 顶部 brand 区域(eyebrow + h1 + 副标题) */
  brand: ReactNode;
  /** 底部固定的操作栏(保存/测试连接/状态) */
  actionBar: ReactNode;
  /** 4 段主体内容 */
  children: ReactNode;
}

/**
 * Options 页面布局壳:顶部 brand + 左侧 Sidebar + 右侧主区 + 底部 actionBar。
 * Phase 2 引入,Phase 4 改用 v2 token + SVG 图标;当前用 v1.0 样式,保持
 * 198 项单测与 release:check 不破坏。
 */
export function OptionsLayout({ sections, brand, actionBar, children }: OptionsLayoutProps) {
  return (
    <div className="td-options-layout">
      <header className="td-options-header">{brand}</header>

      <div className="td-options-body">
        <Sidebar sections={sections} />
        <main className="td-options-main">
          {children}
          {actionBar}
        </main>
      </div>
    </div>
  );
}
