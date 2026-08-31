import { useEffect, useState } from 'react';
import { useTranslation } from '@/src/i18n';

export interface SidebarSection {
  /** 段 id,用作 scroll anchor;`#${id}` 跳转 */
  id: string;
  /** 段的中文显示名(从 i18n 字典传入) */
  label: string;
  /** 段内包含的子项(step 编号 + 标题),用于 sidebar 展开后的子菜单 */
  children: { step: string; label: string }[];
}

interface SidebarProps {
  /** 4 段配置 */
  sections: SidebarSection[];
}

/**
 * Options 页左侧导航。Phase 2 引入,Phase 4 才会换成 v2 token + SVG 图标;
 * 当前用 v1.0 class 与文字 icon,保证 198 项单测与 release:check 不被破坏。
 *
 * - ≥ 960px 桌面:固定 240px 宽
 * - 720–960px:固定 200px 宽
 * - < 720px:折叠为顶部抽屉(默认收起,顶部按钮展开)
 */
export function Sidebar({ sections }: SidebarProps) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 滚动监听:用 IntersectionObserver 找当前可见段,高亮 sidebar
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        // 选最接近视口顶部且相交的段
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 },
    );
    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  function handleNavClick(event: React.MouseEvent<HTMLAnchorElement>, id: string): void {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
    setDrawerOpen(false);
    if (typeof history !== 'undefined' && history.replaceState) {
      history.replaceState(null, '', `#${id}`);
    }
  }

  return (
    <>
      {/* 移动端抽屉切换按钮(只在 < 720px 显示) */}
      <button
        type="button"
        className="td-sidebar-toggle"
        aria-expanded={drawerOpen}
        aria-controls="td-sidebar-nav"
        onClick={() => setDrawerOpen((v) => !v)}
      >
        <span aria-hidden="true">≡</span>
        <span className="td-sidebar-toggle-label">
          {drawerOpen ? t('options.sidebar.collapse') : t('options.sidebar.expand')}
        </span>
      </button>

      <nav
        id="td-sidebar-nav"
        className={`td-sidebar${drawerOpen ? ' td-sidebar--open' : ''}`}
        aria-label={t('options.sidebar.aria')}
      >
        <ol className="td-sidebar-list">
          {sections.map((section, index) => {
            const isActive = activeId === section.id;
            return (
              <li key={section.id} className={`td-sidebar-section${isActive ? ' td-sidebar-section--active' : ''}`}>
                <a
                  href={`#${section.id}`}
                  className="td-sidebar-link"
                  aria-current={isActive ? 'true' : undefined}
                  onClick={(e) => handleNavClick(e, section.id)}
                >
                  <span className="td-sidebar-step">{String(index + 1).padStart(2, '0')}</span>
                  <span className="td-sidebar-label">{section.label}</span>
                </a>
                {section.children.length > 0 && (
                  <ol className="td-sidebar-children">
                    {section.children.map((child) => (
                      <li key={`${section.id}-${child.step}`} className="td-sidebar-child">
                        <a
                          href={`#${section.id}-${child.step}`}
                          className="td-sidebar-child-link"
                          onClick={(e) => {
                            e.preventDefault();
                            const el = document.getElementById(`${section.id}-${child.step}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            setDrawerOpen(false);
                          }}
                        >
                          <span className="td-sidebar-child-step">{child.step}</span>
                          <span>{child.label}</span>
                        </a>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
