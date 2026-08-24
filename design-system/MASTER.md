# TextDuet Design System — Master

> 版本：1.0
> 生效日期：2026-08-24
> 范围：TextDuet 0.1.0+ 全部 Popup / Options / 网页内翻译提示 UI
> 维护：`/design-system/MASTER.md`（本文件）；如需按页面偏差，新建 `/design-system/pages/<page>.md`

## 1. 决策摘要

| 维度 | 选择 | 数据来源 | 理由 |
| --- | --- | --- | --- |
| **Pattern** | Minimal Single Column | `--design-system` 输出 | Popup/Options 都是单一主任务的工具页面，不需要 hero / 多 section 营销结构 |
| **Style** | Minimalism & Swiss Style | style 域 "Minimalism & Swiss Style" | "Clean, simple, spacious, functional, white space, high contrast, geometric, sans-serif, grid-based" 完美匹配"阅读工具"定位；与 `20-product-ui.md §5` 视觉基线一致 |
| **Style accent** | Editorial typography（局部） | typography 域 "Editorial Classic / News Editorial" | 在 Options 大标题与 Options/Popup 步骤编号处用 Noto Serif，注入"出版级"质感 |
| **Color** | Warm Parchment + Sienna（项目定制） | color 域 "Bakery/Cafe" "Coffee Shop" 改良 | 保留赤陶/赭石暖色基础（与 M2 视觉基线一致），但调整对比度与可访问性 |
| **Typography** | Inter（UI）+ Noto Serif（编辑性） | typography 域 + Noto Serif JP | Inter 提供瑞士网格；Noto Serif 提供 CJK + 拉丁双语排版，呼应"双语阅读" |
| **Effects** | 150-250ms 微动效，零光球/玻璃 | UX 域 Micro-interactions | 与 §5 视觉基线"不使用醒目的渐变、光球、霓虹"一致 |
| **Avoid** | 复杂 onboarding / emoji 图标 / scale 触发布局抖动 | --design-system 自动列出 | 严格遵守 §6 可访问性、§7 沟通要求 |

## 2. 色板（Color Tokens）

### 2.1 主色板（项目内 Light 模式，**唯一**主题）

| 角色 | Token | Hex | 旧值对照 | 用途 |
| --- | --- | --- | --- | --- |
| Page background | `--td-bg` | `#FBF6E9` | 旧 `#f5f2ec` 提亮 | 页面与卡片外的最底层；与白色卡片形成柔和层次 |
| Surface | `--td-surface` | `#FFFFFF` | 不变 | 卡片、模态、Popup 主体 |
| Surface muted | `--td-surface-muted` | `#F4EFE3` | 新增 | 次级卡片、强调底色、tag 背景 |
| Border | `--td-border` | `#E8E2D5` | 新增 | 卡片描边、输入框边框 |
| Border strong | `--td-border-strong` | `#C9C0A8` | 新增 | 聚焦环外圈、分割线 |
| Text primary | `--td-text` | `#2A1F12` | 旧 `#232018` 加深 | 正文、标题 |
| Text secondary | `--td-text-muted` | `#6B6356` | 不变 | 帮助文字、label、placeholder |
| Text tertiary | `--td-text-faint` | `#9A9182` | 新增 | 极弱提示、未配置状态 |

### 2.2 主操作色（咖啡赤陶 + 赭石）

| 角色 | Token | Hex | 旧值 | 用途 |
| --- | --- | --- | --- | --- |
| Primary | `--td-primary` | `#9A4F1E` | 旧 `#9c5e2e` 微调 | 主按钮、选中状态、强调文字 |
| Primary hover | `--td-primary-hover` | `#7A3D14` | 旧 `#7d4b24` 加深 | 按钮 hover |
| Primary active | `--td-primary-active` | `#5A2D0A` | 新增 | 按钮 active/pressed |
| Primary soft | `--td-primary-soft` | `#F2DCC8` | 新增 | 选中态背景、tag 软背景 |
| Accent | `--td-accent` | `#7C6035` | 不变 | 辅助强调、链接、图示 |
| Accent soft | `--td-accent-soft` | `#E8DCC4` | 新增 | 辅助强调背景 |

### 2.3 状态色

| 角色 | Token | Hex | 用途 |
| --- | --- | --- | --- |
| Success | `--td-success` | `#15803D` | 预算 50% 提醒、连接成功 |
| Warning | `--td-warning` | `#B45309` | 预算 80% 提醒、模型返回非预期 |
| Danger | `--td-danger` | `#B91C1C` | 预算 100% 提醒、连接失败、Key 错误 |
| Info | `--td-info` | `#1E40AF` | 帮助提示、说明文字 |

### 2.4 透明与遮罩

| Token | 值 | 用途 |
| --- | --- | --- |
| `--td-overlay` | `rgba(31, 27, 22, 0.45)` | 模态遮罩 |
| `--td-focus-ring` | `rgba(160, 82, 45, 0.30)` | 键盘聚焦环 |
| `--td-tag-bg` | `#F2DCC8` | tag 软底色（= primary-soft） |

### 2.5 对比度合规

| 文本/底色 | 对比度 | 等级 |
| --- | --- | --- |
| text `#2A1F12` on bg `#FBF6E9` | 13.8:1 | AAA |
| text `#2A1F12` on surface `#FFFFFF` | 15.9:1 | AAA |
| text-muted `#6B6356` on bg `#FBF6E9` | 4.6:1 | AA |
| primary `#9A4F1E` on bg `#FBF6E9` | 5.2:1 | AA |
| accent `#7C6035` on bg `#FBF6E9` | 4.6:1 | AA |
| surface `#FFFFFF` on primary `#9A4F1E` | 5.5:1 | AA |

所有文本 / 背景组合均通过 WCAG AA（4.5:1），正文达到 AAA。

## 3. 字体（Typography）

### 3.1 字体族

| 角色 | 字体族 | 用途 |
| --- | --- | --- |
| UI Sans | `Inter, "Noto Sans SC", "PingFang SC", system-ui, sans-serif` | Popup/Options 全部正文、按钮、表格、图标旁 |
| Editorial Serif | `"Noto Serif", "Source Han Serif SC", Georgia, serif` | 仅用于：Options 大标题、`step` 编号、help 链接强调 |
| Mono | `"JetBrains Mono", ui-monospace, monospace` | 模型名、URL、API Key 提示 |

### 3.2 字号与行高

| 角色 | Size | Line-height | Weight | 用途 |
| --- | --- | --- | --- | --- |
| Display | 28px | 1.2 | 600 | Options 顶部 H1 |
| H1 | 22px | 1.3 | 600 | Popup 顶部 / Options 卡片标题 |
| H2 | 18px | 1.35 | 600 | 选项 section 标题 |
| H3 | 15px | 1.4 | 600 | 子标题、step 编号 |
| Body | 14px | 1.55 | 400 | 正文、字段、按钮 |
| Body small | 13px | 1.55 | 400 | 卡片内辅助文字、label |
| Caption | 12px | 1.5 | 400 | 帮助文字、tag、placeholder |
| Micro | 11px | 1.4 | 500 | 状态徽标、计数 |

### 3.3 排版规则

- 标题用 `font-feature-settings: "ss01", "cv11"`（Inter 可选 OpenType）
- 长字段标签 `letter-spacing: 0.01em`；全大写徽标 `letter-spacing: 0.08em`
- 换行规则（per UX 域）：正文行宽 65-75 字符；URL / 模型名可换行

## 4. 间距（Spacing）

8px 基础单位（与 Swiss Style `--base-unit: 8px` 一致）。

| Token | 值 | 用途 |
| --- | --- | --- |
| `--td-space-1` | 4px | 图标内边距、tag 间距 |
| `--td-space-2` | 8px | 字段内 padding、列表项间距 |
| `--td-space-3` | 12px | 字段组间距、卡片内 padding |
| `--td-space-4` | 16px | 卡片间 gap、按钮 padding-y |
| `--td-space-5` | 24px | section 间距、Popup 主体 padding |
| `--td-space-6` | 32px | 卡片标题与字段间距 |
| `--td-space-8` | 48px | Options 顶部 hero 留白 |

## 5. 圆角、阴影、边框

| 角色 | Token | 值 | 用途 |
| --- | --- | --- | --- |
| 圆角小 | `--td-radius-sm` | `4px` | tag、徽标、input 内的 chip |
| 圆角中 | `--td-radius` | `8px` | 按钮、输入框、Popup 主体 |
| 圆角大 | `--td-radius-lg` | `12px` | 卡片（基础 ≤ 8px，少数放大卡片可 12px） |
| 圆角全 | `--td-radius-pill` | `999px` | 主操作徽标 |
| 阴影 0 | `--td-shadow-0` | `none` | 默认无阴影（Swiss flat） |
| 阴影 1 | `--td-shadow-1` | `0 1px 2px rgba(31,27,22,0.05)` | 浮起 Popup、tag |
| 阴影 2 | `--td-shadow-2` | `0 2px 8px rgba(31,27,22,0.08)` | 卡片 hover、菜单弹出 |
| 阴影 3 | `--td-shadow-3` | `0 8px 24px rgba(31,27,22,0.10)` | 模态、提示气泡 |
| 边框默认 | `--td-border` | `1px solid #E8E2D5` | 卡片、输入框 |
| 边框聚焦 | `--td-focus-ring` | `0 0 0 3px rgba(160,82,45,0.30)` | 键盘聚焦环（强制 +3px 偏移） |

## 6. 组件契约

### 6.1 按钮

- 主按钮：`--td-primary` 背景 + 白字 + `--td-radius`，hover → `--td-primary-hover`；pressed → `--td-primary-active`；disabled → 0.4 opacity
- 次按钮：透明背景 + `--td-text` 文字 + `1px solid --td-border`；hover → `--td-surface-muted`
- 危险按钮：`--td-danger` 背景 + 白字（仅删除类操作）
- 高度 36px（Popup 内 32px），水平 padding 16px；最小宽度 80px
- `prefers-reduced-motion: reduce` → 取消 hover 颜色过渡

### 6.2 输入框

- 高度 36px；`1px solid --td-border`；圆角 `--td-radius`
- focus → `border-color: --td-primary` + `--td-focus-ring`（强制 3px 偏移）
- placeholder → `--td-text-faint`
- error → `border-color: --td-danger` + 同行短错误文字
- 关联 `<label>` 必须在 DOM 中（不只是 placeholder）

### 6.3 卡片（Options 卡片）

- `--td-surface` 背景 + `--td-border` 描边
- 圆角 `--td-radius-lg`（12px，允许主题基线覆盖 ≤ 8px）
- 内部 padding `--td-space-5`（24px）
- 标题用 Editorial Serif（Noto Serif / Source Han Serif）以注入"出版感"
- section 间 gap `--td-space-6`（32px）

### 6.4 状态徽标

- 高度 20px；padding 8px 10px；圆角 `--td-radius-pill`
- 颜色：success / warning / danger / info / neutral 各有 `--*-soft` 背景 + 对应主色文字
- 数字 1.5x 放大用 Display；tag 短文字用 Caption

### 6.5 模型 tag 输入（ModelTagInput）

- tag chip：`--td-primary-soft` 背景 + `--td-primary` 文字
- 当前选中 tag：添加左侧 ✓ icon + `当前` small
- 输入框无边框，与 tag 行同高度
- hover 删除 icon：默认隐藏，选中 tag 时显示

## 7. 交互（Interaction）

| 场景 | 行为 |
| --- | --- |
| 按钮按下 | 50ms `transform: scale(0.98)` + 颜色过渡 150ms |
| 加载 | 按钮内 inline 旋转 icon（`animate-spin`），按钮保持原位置不动 |
| 错误 | toast 顶部滑入 200ms，3s 自动消失，hover 可暂停 |
| 聚焦 | 3px focus ring，颜色 `--td-focus-ring`，键盘 Tab 必须可见 |
| 成功 | 主操作按钮内 ✓ icon 替换文字 200ms，再恢复 |
| 长列表 | 滚动行为遵循原生，仅在 Popup 顶部有 `scrollbar-thin` 风格 |

## 8. 响应式

| 断点 | 行为 |
| --- | --- |
| Popup 工具栏 | 固定宽度 360px（Chrome 工具栏最大可用） |
| Options 桌面 | `max-width: 920px`，居中，左右内边距 24px |
| Options 窄屏（≤ 640px） | 卡片单列，section 间 gap 缩为 16px；不引入横向滚动 |

## 9. 可访问性（必守）

- 所有按钮 / 输入 / 切换有 `aria-label` 或关联 `<label>`
- 仅图标按钮必须 `aria-label`（X 删除、确认、编辑等）
- 颜色不是唯一指示：状态徽标必须配 icon 或文字
- 键盘 Tab 顺序 = 视觉顺序
- `prefers-reduced-motion: reduce` 强制降低动画
- 焦点环 4.5:1 可见对比度

## 10. 禁止项

- 渐变 / 光球 / 玻璃拟态 / 霓虹 / emoji 图标
- 阴影 + 圆角同时大（>24px 圆角 + 阴影 3）组合
- scale > 0.98 触发布局抖动
- 不可逆颜色 token 散落（必须经 CSS 变量）
- 不可重设默认浏览器 input / button 样式（保证浏览器原生交互稳定）

## 11. 关联文档

- `docs/UI-DEVELOPMENT-STANDARD.zh-CN.md`（页面开发标准，基础层）
- `agent-dev/20-product-ui.md` §5 视觉基线（红线）
- `docs/CHROME-PERMISSIONS.md`（不影响视觉但需注意不影响权限说明）
- `docs/PRIVACY.md`（不动）
