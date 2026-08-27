# TextDuet Design System — Master

> 版本：2.0(v2 设计 token,2026-08-26 启动,2026-08-26 由 v1.0 升级)
> 生效日期：2026-08-26
> 范围：TextDuet 0.2.0+ 全部 Popup / Options / Sidebar / 网页内翻译提示 UI
> 维护：`/design-system/MASTER.md`（本文件）；如需按页面偏差，新建 `/design-system/pages/<page>.md`

## 1. 决策摘要

| 维度 | 选择 | 数据来源 | 理由 |
| --- | --- | --- | --- |
| **Pattern** | Minimal Single Column | `--design-system` 输出 | Popup/Options 都是单一主任务的工具页面，不需要 hero / 多 section 营销结构 |
| **Style** | Minimalism & Swiss Style | style 域 "Minimalism & Swiss Style" | "Clean, simple, spacious, functional, white space, high contrast, geometric, sans-serif, grid-based" 完美匹配"阅读工具"定位；与 `20-product-ui.md §5` 视觉基线一致 |
| **Style accent** | Editorial typography（局部） | typography 域 "Editorial Classic / News Editorial" | 在 Options 大标题与 Options/Popup 步骤编号处用 Noto Serif，注入"出版级"质感 |
| **Color** | **Warm Parchment + Coffee Sienna** | `color-sampling.py` 评估 2754 候选后选定（详见 §1.1） | 见 §1.1 数据驱动决策 |
| **Typography** | Inter（UI）+ Noto Serif（编辑性） | typography 域 + Noto Serif JP | Inter 提供瑞士网格；Noto Serif 提供 CJK + 拉丁双语排版，呼应"双语阅读" |
| **Effects** | 150-250ms 微动效，零光球/玻璃 | UX 域 Micro-interactions | 与 §5 视觉基线"不使用醒目的渐变、光球、霓虹"一致 |
| **Avoid** | 复杂 onboarding / emoji 图标 / scale 触发布局抖动 | --design-system 自动列出 | 严格遵守 §6 可访问性、§7 沟通要求 |

### 1.1 数据驱动配色决策

- **方法**：用 `design-system/color-sampling.py` 拉取 ui-ux-pro-max 调色板库 35 个关键词 × 15 调色板，**去重后 34 套基础调色板**；对每套生成 bg/primary/cta/text 4 维 × 10 档 tint/shade 衍生，**总计 2754 候选**；按 6 项硬约束（product_fit / readability / cta_warmth / neutrality / accessibility / distinguish）加权打分；剔除 dating / beauty / romantic / gaming / wedding / lifestyle / creative agency / creative design portfolio 这 8 类离调产品类型。
- **Top 1**：Coffee Shop `primary=#78350F / bg=#FEF9E5 / text=#451A03` — 得分 13.61 / 15（满分）。优点：暖棕饱和度够、text 极深 18:1 对比、bg 中性；但太 rustic 直接采用会偏离"瑞士网格 + 编辑性"调性。
- **Top 2**：Bakery/Cafe `primary=#92400E / bg=#FEF9E5 / text=#78350F` — 得分 13.58，文字饱和度略浅、对比 9.4:1。
- **最终采用**：`primary=#9A4F1E / bg=#FBF6E9 / text=#2A1F12` —— 在 Coffee Shop 暖棕与 M2 视觉基线赤陶之间折中；保留暖纸/赤陶/赭石三色家族；WCAG AAA；不破现有组件代号与语义。
- **退化方案**：在 M2 已验证的 `#9c5e2e / #f5f2ec / #232018` 之上微调对比度而非推翻，保证 0.1.0 候选视觉不破坏 158 项测试。

### 1.2 v2 Token 系统(2026-08-26,TD-2026-025)

v1.0(13 个 token)在 0.1.0 / 0.1.1 已通过 198 项单测;v2 不推翻品牌家族(warm parchment + sienna + olive),而是**把单值扩展为 6 语义色族 × 5 档 shade**,让 Popup / Options / Sidebar / 状态条 / 诊断包 / 翻译提示在同一色族内做层次,而不是来回切换 hex。

| 维度 | v1.0(已验证) | v2(0.2.0) |
| --- | --- | --- |
| 颜色 | 13 个独立 token | **6 语义色族 × 5 档 shade = 30 个 token** |
| 字体 | 7 档字号 | **11 档**(新增 Display 1/2/3、Body-strong、Micro-eyebrow) |
| 间距 | 隐式(直接用 4/8/12/16/24) | **11 档 0/1/2/3/4/5/6/8/10/12/16**(--td-space-*) |
| 圆角 | 14px 卡 / 8px 控件 / 999px pill | **6 档 0/4/8/12/16/full**(--td-radius-*) |
| 阴影 | 1/2/3 三档 | **5 档 0/1/2/3 + inset-1**(--td-shadow-*) |
| 图标尺寸 | 13 / 14 硬编码 | **7 档 12/14/16/20/24/32/40**(--td-icon-*) |
| 图标库 | `lucide-react` | **手设计 SVG 套件 `src/icons/`** |

#### 1.2.A 6 语义色族(继承 warm-craft + 深化)

| 色族 | 角色 | 5 档 shade(50 / 100 / 300 / 500 / 700) |
| --- | --- | --- |
| `--td-paper` | 暖纸背景与表面 | 50 米白 / 100 暖纸 / 300 沙岩 / 500 焦糖 / 700 深焙 |
| `--td-ink` | 正文与图标 | 50 浅墨 / 100 灰墨 / 300 中墨 / 500 浓墨 / 700 玄墨 |
| `--td-coffee` | 主色(赤陶 / Sienna) | 50 米陶 / 100 浅陶 / 300 主陶 / 500 深陶 / 700 焦陶 |
| `--td-clay` | 强调(赭石 / Olive) | 50 沙赭 / 100 浅赭 / 300 主赭 / 500 深赭 / 700 焦赭 |
| `--td-mist` | 状态中性(绿/蓝/红/黄/紫) | 50 雾绿 / 100 雾琥珀 / 300 雾赤 / 500 雾蓝 / 700 雾紫 |
| `--td-shadow` | 阴影与边框 | 50 影淡 / 100 影浅 / 300 影中 / 500 影浓 / 700 影重 |

每个色族 5 档 shade 对应 light / muted / base / hover / pressed 5 个 UI 状态,避免 v1.0 那种"调一个色就要挑三个 hex"的散落。

#### 1.2.B Token 命名规范

```
--td-{色族}-{档位}        原始色:    --td-paper-100
--td-{色族}-{档位}-text    文字色:   --td-paper-700-text    (WCAG AA 配对)
--td-{role}-{state}        语义色:    --td-role-action-base  (--td-coffee-300)
```

#### 1.2.C 不变量(从 v1.0 继承,不允许修改)

- 页面背景:仍为暖纸 `--td-paper-100`
- 正文:仍为深墨 `--td-ink-500`
- 主操作:仍为赤陶 `--td-coffee-300`
- WCAG AA 正文 4.5:1,大字号 3:1
- 暖纸/赤陶/赭石三色家族不替换为冷色
- 玻璃拟态 / 渐变 / 光球 / 霓虹:全部禁用(taste-skill §5 + agent-dev/20-product-ui §5)

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

---

# v2 Token Reference(TD-2026-025,2026-08-26)

> 本节是 v2 token 的**完整规格**,P4 实施时 CSS 变量值直接照抄本表;P3 之前任何 token 调整需先回到本表更新。

## 12. v2 调色板完整表(30 token)

### 12.A `--td-paper`(暖纸,5 档)

| Token | 角色 | Hex | v1.0 对照 |
| --- | --- | --- | --- |
| `--td-paper-50` | 米白(微弱 hover 底) | `#FDFAF2` | 新增 |
| `--td-paper-100` | 暖纸(页面背景) | `#FBF6E9` | 沿用 v1.0 `--td-bg` |
| `--td-paper-300` | 沙岩(card 容器表面) | `#F4EFE3` | 沿用 v1.0 `--td-surface-muted` |
| `--td-paper-500` | 焦糖(深 hover / 选中态底) | `#E8DFCB` | 新增 |
| `--td-paper-700` | 深焙(深色底 / 暗色 hover) | `#C9C0A8` | 沿用 v1.0 `--td-border-strong` |

### 12.B `--td-ink`(墨,5 档)

| Token | 角色 | Hex | v1.0 对照 |
| --- | --- | --- | --- |
| `--td-ink-50` | 浅墨(placeholder / disabled 文字) | `#A89F8E` | 沿用 v1.0 `--td-text-faint` |
| `--td-ink-100` | 灰墨(辅助文字 / label) | `#6B6356` | 沿用 v1.0 `--td-text-muted` |
| `--td-ink-300` | 中墨(次要正文) | `#3D3528` | 新增 |
| `--td-ink-500` | 浓墨(主要正文 / 标题) | `#2A1F12` | 沿用 v1.0 `--td-text` |
| `--td-ink-700` | 玄墨(关键数字 / 高对比) | `#15110B` | 新增 |

### 12.C `--td-coffee`(赤陶,主色,5 档)

| Token | 角色 | Hex | v1.0 对照 |
| --- | --- | --- | --- |
| `--td-coffee-50` | 米陶(hover 底) | `#F2DCC8` | 沿用 v1.0 `--td-primary-soft` |
| `--td-coffee-100` | 浅陶(选中态描边 / 弱按钮底) | `#D4A073` | 新增 |
| `--td-coffee-300` | 主陶(主按钮 / 主图标) | `#9A4F1E` | 沿用 v1.0 `--td-primary` |
| `--td-coffee-500` | 深陶(主按钮 hover) | `#7A3D14` | 沿用 v1.0 `--td-primary-hover` |
| `--td-coffee-700` | 焦陶(主按钮 pressed) | `#5A2D0A` | 沿用 v1.0 `--td-primary-active` |

### 12.D `--td-clay`(赭石,辅色,5 档)

| Token | 角色 | Hex | v1.0 对照 |
| --- | --- | --- | --- |
| `--td-clay-50` | 沙赭(辅底) | `#E8DCC4` | 沿用 v1.0 `--td-accent-soft` |
| `--td-clay-100` | 浅赭(辅图标 / 弱描边) | `#B89B6C` | 新增 |
| `--td-clay-300` | 主赭(辅文字 / step 编号) | `#7C6035` | 沿用 v1.0 `--td-accent` |
| `--td-clay-500` | 深赭(辅按钮) | `#5C4628` | 新增 |
| `--td-clay-700` | 焦赭(辅按钮 pressed) | `#3D2F1A` | 新增 |

### 12.E `--td-mist`(状态中性,5 档对应 5 状态)

| Token | 角色 | Hex | v1.0 对照 |
| --- | --- | --- | --- |
| `--td-mist-50` | 雾绿(success 软底) | `#D1F0DE` | 新增(派生自 success) |
| `--td-mist-100` | 雾琥珀(warning 软底) | `#FAE5C8` | 新增(派生自 warning) |
| `--td-mist-300` | 雾赤(danger 软底) | `#F8D7D5` | 新增(派生自 danger) |
| `--td-mist-500` | 雾蓝(info 软底) | `#D6E0F4` | 新增(派生自 info) |
| `--td-mist-700` | 雾紫(neutral / 软底) | `#E5DFE8` | 新增 |

> mist 族只用于"软底色",对应强色版用 v1.0 的 success/warning/danger/info hex 直接取。

### 12.F `--td-shadow`(阴影 / 边框,5 档)

| Token | 角色 | Hex / RGBA |
| --- | --- | --- |
| `--td-shadow-50` | 影淡(默认卡片边框) | `#E8E2D5` |
| `--td-shadow-100` | 影浅(hover 边框) | `#D9D0C1` |
| `--td-shadow-300` | 影中(默认卡片阴影) | `rgba(31, 27, 22, 0.08)` |
| `--td-shadow-500` | 影浓(弹层阴影) | `rgba(31, 27, 22, 0.18)` |
| `--td-shadow-700` | 影重(Modal 阴影) | `rgba(31, 27, 22, 0.32)` |

## 13. v2 字体表(11 档)

| Token | size | line-height | weight | 用途 |
| --- | --- | --- | --- | --- |
| `--td-text-display-1` | 40px | 1.1 | 600 | Options 顶部 H1 |
| `--td-text-display-2` | 32px | 1.15 | 600 | Sidebar 品牌字 |
| `--td-text-display-3` | 24px | 1.2 | 600 | 卡片 H2 |
| `--td-text-h1` | 20px | 1.3 | 600 | Popup 顶 / 段标题 |
| `--td-text-h2` | 18px | 1.35 | 600 | 段副标题 |
| `--td-text-h3` | 15px | 1.4 | 600 | 子标题 / 字段组 |
| `--td-text-body` | 14px | 1.55 | 400 | 正文 / 字段 |
| `--td-text-body-strong` | 14px | 1.55 | 600 | 加粗正文 / 数字 |
| `--td-text-caption` | 12px | 1.5 | 400 | 帮助 / label / placeholder |
| `--td-text-micro` | 11px | 1.4 | 500 | 状态徽标 / 计数 |
| `--td-text-eyebrow` | 10px | 1.4 | 600 | 标签 / 段号(全大写) |

字体族沿用 v1.0:Inter(UI) + Noto Serif(editorial accent) + JetBrains Mono(model/URL)。

## 14. v2 间距表(11 档,8px 基础)

| Token | px | 用途 |
| --- | --- | --- |
| `--td-space-0` | 0 | reset |
| `--td-space-1` | 4 | icon 内边距、tag 间距 |
| `--td-space-2` | 8 | 字段内 padding、列表项间距 |
| `--td-space-3` | 12 | 字段组间距、卡片内 padding |
| `--td-space-4` | 16 | 卡片间 gap、按钮 padding-y |
| `--td-space-5` | 24 | section 间距、Popup 主体 padding |
| `--td-space-6` | 32 | 卡片标题与字段间距 |
| `--td-space-8` | 48 | 区域间距 |
| `--td-space-10` | 64 | 页面顶部留白 |
| `--td-space-12` | 96 | 大段间距 |
| `--td-space-16` | 128 | 罕见极长 section |

## 15. v2 圆角表(6 档)

| Token | px | 用途 |
| --- | --- | --- |
| `--td-radius-0` | 0 | 数据表格 / 极简骨架 |
| `--td-radius-1` | 4 | tag / 徽标 / icon 容器的内层 |
| `--td-radius-2` | 8 | 按钮 / 输入框 / Popup 主体 |
| `--td-radius-3` | 12 | 卡片(基础) |
| `--td-radius-4` | 16 | 大卡片 / Modal 主体 |
| `--td-radius-full` | 999 | pill / 圆形按钮 / 头像 |

> v1.0 用了 14px 卡 / 8px 控件 / 999px pill 三档,v2 统一到 6 档离散值,与 `--td-space-*` 节奏一致。

## 16. v2 阴影表(5 档 + 1 内阴影)

| Token | 用途 |
| --- | --- |
| `--td-shadow-0` | 无阴影(Swiss flat 默认) |
| `--td-shadow-1` | tag / 浮起 Popup(0 1px 2px 影淡) |
| `--td-shadow-2` | 卡片 hover(0 2px 8px 影中) |
| `--td-shadow-3` | Modal / 提示气泡(0 8px 24px 影浓) |
| `--td-shadow-4` | 模态遮罩层(0 16px 48px 影重) |
| `--td-shadow-inset-1` | 输入框聚焦内阴影(inset 0 1px 2px 影中) |

## 17. v2 图标尺寸表(7 档)

| Token | px | 用途 |
| --- | --- | --- |
| `--td-icon-12` | 12 | 行内 / 表格内 |
| `--td-icon-14` | 14 | caption 旁 / 微标识 |
| `--td-icon-16` | 16 | body 旁 / form helper |
| `--td-icon-20` | 20 | 按钮内 / 强调行 |
| `--td-icon-24` | 24 | 默认图标 / 卡片操作 |
| `--td-icon-32` | 32 | section 标题 / 大标识 |
| `--td-icon-40` | 40 | hero / 启动屏 |

## 18. v2 焦点环(3 档)

| Token | 值 | 用途 |
| --- | --- | --- |
| `--td-focus-1` | `0 0 0 3px rgba(154, 79, 30, 0.30)` | 默认键盘聚焦 |
| `--td-focus-2` | `0 0 0 4px rgba(154, 79, 30, 0.40)` | 主操作 / Modal |
| `--td-focus-3` | `0 0 0 6px rgba(154, 79, 30, 0.20)` | 大型交互(滑块 / 颜色) |

## 19. v2 z-index 阶梯

| Token | 值 | 用途 |
| --- | --- | --- |
| `--td-z-base` | 0 | 内容层 |
| `--td-z-sticky` | 10 | Sidebar 固定 / Popup 顶 |
| `--td-z-popup` | 20 | 语言菜单 / popover |
| `--td-z-modal` | 50 | Modal / 确认对话框 |
| `--td-z-toast` | 80 | 错误 / 成功提示 |
| `--td-z-tooltip` | 100 | hover 提示 |

## 20. v2 动效曲线(继承 v1.0)

| Token | 值 | 用途 |
| --- | --- | --- |
| `--td-ease-default` | `cubic-bezier(0.32, 0.72, 0.32, 1)` | 默认 |
| `--td-ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | 入场 |
| `--td-ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | 出场 |
| `--td-dur-1` | 80ms | 按下瞬时 |
| `--td-dur-2` | 150ms | 颜色 / 边框 |
| `--td-dur-3` | 250ms | 卡片浮起 |
| `--td-dur-4` | 400ms | Modal 入场 |

## 21. v2 禁止项(从 v1.0 继承 + 强化)

- 渐变 / 光球 / 玻璃拟态 / 霓虹 / emoji 图标 — 全部禁用
- 散落 hex 颜色(必须经 CSS 变量)
- 圆角与阴影组合 > 24px + 影重 — 禁用
- 数字标签版本号(0.1.0 / v0.6)出现在 Popup / Options 营销面
- "Stage 1 / Phase 01" 类步骤枚举标签在 UI 上
- 命名带 em-dash(— / –)的任何用户可见字符串(taste-skill §9.G)
- "Scroll" / "↓ scroll" / "Scroll to explore" 滚动提示
- "Used by" 品牌矩阵只放 logo,不放行业 / 分类标签

## 22. v2 验收清单(替换 v1.0 §14)

- [ ] 所有颜色使用 `var(--td-*)` token,grep `#[0-9a-fA-F]{3,6}` 在 style.css / *.tsx 中只允许出现在 `tokens.css` 与 `src/icons/*.svg` 中
- [ ] 所有间距使用 `var(--td-space-*)`,8 倍数节奏
- [ ] 所有圆角使用 `var(--td-radius-*)`,不允许 14px / 7px 等离散值
- [ ] 所有图标从 `src/icons/` 导入,不使用 lucide-react / Phosphor / Tabler
- [ ] 所有焦点环使用 `var(--td-focus-*)`
- [ ] 所有阴影使用 `var(--td-shadow-*)`
- [ ] Popup / Sidebar / Options / 状态条视觉一致
- [ ] WCAG AA 全部 token 组合通过(由 verify-tokens.mjs 校验)
- [ ] `npm run typecheck` / `npm test` / `npm run build` / `npm run release:check` 全过
- [ ] 198+ 单测全部回归(不可降级、不可加 skip)
- [ ] 项目所有者 Chrome 安装态目视验收通过
