# 30 Engineering Rules

本文件适用于代码、测试、配置、目录、依赖和工程结构变更。

## 1. 目录职责

```text
entrypoints/
  background.ts       MV3 Service Worker 入口与可信消息编排
  translator.ts       用户触发后按需注入的低权限页面执行层
  popup/               工具栏高频控制 UI
  options/             Provider、密钥、价格与预算配置 UI
src/
  core/                跨上下文类型、运行时 schema、默认配置和纯领域逻辑
  providers/           Provider 请求、认证、响应解析与错误标准化
  storage/             扩展可信上下文的存储和迁移
tests/                 单元、集成测试与原创 HTML 验收语料
docs/                  PRD、架构、许可证和兼容性决策
agent-dev/             Agent 分层开发规范
```

边界规则：

- `entrypoints/` 只做上下文装配，不沉积可复用算法。
- DOM 提取与渲染属于 Translator 领域；可测试的纯提取/分批逻辑下沉到 `src/core/`。
- Provider 网络与协议只存在于 `src/providers/` 并由 Service Worker 调用。
- Storage 只由可信扩展上下文访问；内容脚本不得导入存储模块。
- Popup/Options 不直接调用 Provider，不读取 API Key 原文。
- 公共类型和运行时 schema 共置，避免各上下文手写不同消息形状。
- 轻量模块允许单文件；只有出现稳定领域边界时才建目录和 `index.ts`。

## 2. 依赖方向

允许的主方向：

```text
entrypoints -> src/core
background  -> src/providers + src/storage
providers   -> src/core
storage     -> src/core
popup/options -> src/core + browser runtime messages
translator -> src/core contracts（不得反向依赖 providers/storage/UI）
```

禁止循环依赖和跨域反向依赖。Provider 不依赖 React；核心纯逻辑不依赖扩展 UI。

## 3. TypeScript 与运行时校验

- 保持 `strict`，不新增 `any`、无理由的非空断言或双重类型断言。
- 外部输入先以 `unknown` 接收，再使用类型守卫或 schema 校验。
- `RuntimeMessage` 使用判别联合；消息监听器必须运行时校验，不能直接 `as RuntimeMessage` 后信任。
- JSON 模型输出必须验证对象类型、字段类型、ID 唯一性和集合一致性。
- 导出类型、函数和常量采用明确语义名称；布尔值用 `is/has/can/should` 前缀。
- React Props 使用 `interface XxxProps`；回调使用 `onXxx`。
- 禁止保留未使用 import、变量、参数、死分支或被注释掉的大段代码。

运行时类型由 `src/core/schemas.ts` 的 Zod schema 推导；不得另写一套可能漂移的接口。所有跨上下文未知值必须先解析，错误信息不得暴露 schema 细节或敏感输入。

## 4. React 与扩展上下文

- 组件 render 不执行异步副作用；请求和 runtime 消息放事件或 effect 中。
- effect、事件监听、Observer、timer 和 AbortController 必须有清理路径。
- 不默认添加 `useMemo`/`useCallback`；只有昂贵派生或稳定引用契约需要时使用。
- Popup 被关闭随时会卸载；长期任务状态由 Service Worker/持久状态提供，不能只依赖组件 state。
- Service Worker 会被回收；需要恢复的任务状态必须可重建或存储。
- 内容脚本注入可能重复发生；安装标记、消息监听和 DOM 插入必须幂等。

## 5. Provider 实现

- 统一实现 `translate` 与 `testConnection` 契约；认证、URL 和解析不得泄漏到 UI。
- URL 使用 `URL` API 归一化；只允许 HTTPS，并避免重复追加 endpoint。
- 为请求配置超时、取消和标准化错误；不得无限重试。
- 只发送完成翻译所需字段，模型参数采用保守默认值。
- 测试使用假 Provider 或 mock fetch；真实 Key 只用于用户控制的本地手工测试。
- 新 Provider 在新增前明确协议差异、权限 Origin、错误映射、usage 字段和测试矩阵。

## 6. DOM 与性能实现

- DOM 候选选择保持保守，先排除交互、代码、编辑和隐藏区域。
- 纯提取、文本正规化、分批、哈希、缓存键和预算公式应拆成可单测函数。
- 默认单块 2–4000 字符，单批不超过当前契约预算；调整阈值需基准或测试证据。
- 并发请求默认不超过 2；处理大量节点时避免同步长任务阻塞页面。
- 用稳定的 TextDuet 命名空间标记 DOM，避免与站点 class/dataset 冲突。
- 所有模型文本通过 `textContent` 渲染。

## 7. 存储与迁移

- 为持久化结构设置显式版本；结构变化提供向前迁移和失败回退。
- 存储 Key 使用稳定 `textduet`/领域命名空间；已发布后不得无迁移重命名。
- 设置保存应尽可能原子化，验证通过后再写入。
- 缓存键至少包含文本哈希、语言对、Provider、模型和提示词版本，不含 Key。
- 用量账本区分实际与估算，并按本地日期处理跨日。
- 删除或迁移用户数据前必须获得明确授权并提供可恢复方案或清晰说明。

## 8. 命名、注释与文件规模

- React 组件：`PascalCase.tsx`；Hooks：`useXxx.ts`；普通模块：语义化 `kebab-case.ts` 或沿用所在目录现有风格。
- 代码标识使用英文；面向当前主要维护者的解释性注释可使用中文。
- 注释解释原因、边界、兼容或停止条件，不重复代码表面行为。
- 导出公共 API、复杂状态机、安全边界和非直观字段映射使用 JSDoc；局部显然函数无需模板化注释。

目标阈值：

| 文件类型 | 目标行数 |
| --- | --- |
| 单 React 组件 | `<= 250` |
| 单 hook | `<= 200` |
| Service Worker 入口 | `<= 250` |
| Translator 入口 | `<= 300` |
| 单 Provider | `<= 250` |
| 单类型/Schema 文件 | `<= 400` |

超过阈值时按职责拆分，不为了行数机械切割。既有超标文件可随相关任务逐步收敛。

## 9. 测试规则

- Bug 修复先增加能复现问题的测试，或说明为何无法自动化。
- 核心纯逻辑采用确定性单元测试；网络使用 mock，不依赖实时模型或价格。
- HTML fixture 必须为项目原创短文本，不复制第三方全文，不含私人数据。
- 安全测试至少覆盖恶意 HTML/脚本字符串、畸形 JSON、ID 不一致和内容脚本无法取得 Key。
- 成本测试使用固定价格、token 和本地日期，覆盖阈值只提醒一次及跨日重置。
- 网站兼容结构测试与翻译质量评估分离，结构回归不得依赖模型随机输出。

## 10. 依赖与许可证

- 默认使用 npm 和已锁定依赖；不要混用 pnpm、Yarn 或 Bun。
- 不得安装 `next`，不得采用要求 Next.js App Router、SSR、Server Components 或 Next 专属构建插件的组件与模板；仅有 React/Vite 手动安装方式的组件可以评估。
- 当前批准的 UI/校验基线为 `zod/mini`、按组件安装的 `@radix-ui/react-*`、`lucide-react`。Radix 和 Lucide 仅在 Popup/Options 按需导入，不进入 Translator Script；不得混入第二套 UI 原语库。
- 新依赖必须先确认必要性、维护状态、包体积、Chrome MV3 兼容、许可证和供应链风险，并获得用户授权。
- 不使用 CDN 脚本或运行时下载代码；所有可执行代码随扩展打包。
- 引入第三方代码/资产必须记录许可证与归属，按需更新 `NOTICE`。
