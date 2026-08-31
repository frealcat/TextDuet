# Changelog

TextDuet 的用户可见变化记录在此文件中。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

当前最新发布：**未发布**。2026-08-26 项目所有者评估后决定跳过 0.1.0,直接发布 0.2.0(整合 0.1.0 + 0.1.1 + TD-2026-022/023/024 + TD-2026-025 完整重设计)。`Unreleased` 段保留给 0.2.0 及后续版本的待写入条目。

## [Unreleased]

### Fixed

- 修复 TD-2026-WS3(API Key 按 Origin 隔离)引入的配置读取回归:保存过配置后,Popup 与 Options 页提示「无法读取扩展配置」,扩展无法使用。根因是 Service Worker 把含原始 API Key 的设置对象原样回传给扩展页,触发泄漏防御检查整体拒绝;现在公共视图通过 `buildPublicProviderSettings` 构造,`apiKey` / `apiKeyByOrigin` 不再跨越 Service Worker 边界。
- 修复切换浏览器与其他 App 时译文区域被反复清除重插的问题:标签页恢复可见不再触发「清空全部译文 + 重扫」,改为仅对账扫描(已渲染且文本未变化的段落直接跳过),消除闪动与重复插入。
- 修复 SPA 路由切换后动态内容监听失效的隐患:`onNavigate` 不再调用 `observer.abort()`(该调用会让 MutationObserver 在首次导航后永久失效,新视图的滚动加载内容不再被翻译)。
- 修复切换 Base URL 后 `getApiKey` 未按 per-origin 映射解析、回退到全局旧 Key 的问题;余额查询、连接测试、i18n 字典翻译与翻译主链路现在都按当前 Origin 取 Key。
- 修复 active/inactive 往返后 SPA 对账扫描递归翻译插件自身 DOM 的致命重复插入：候选提取跳过 TextDuet 的原文/译文/选区节点及当前已渲染源节点的包装后代；译文以源元素 ID 归属、可跨 SPA 包装恢复并回到源元素直接子级，既不误删真实子节点译文，也不会在 `translated-only` 模式被原文包装层隐藏。可见性节流仅在页面恢复 `visible` 后生效，避免 hidden 事件吞掉紧随其后的对账扫描。
- 修复流式响应在异常、断流或不完整 SSE 下留下部分译文的问题：Provider 先完成 SSE/JSON、字段和区块 ID 集合校验，再由 Service Worker 一次性提交整批结果；旧式单块事件也不会绕过完整批次校验。
- 修复 SPA 视图切换和选区变化期间迟到响应污染新页面的问题：请求绑定当前 run、视图 generation、选区版本、锚点、URL 和原文快照，失效结果只清理自身状态而不写入 DOM。
- 修复流式 Port 在页面进入 bfcache、导航或同步 `postMessage` 失败时的清理与身份边界：只接受已校验的网页标签页 sender；已知 Chrome 生命周期断连会归类为可重试事件，其他发送错误仍按普通失败处理，端口异常会安全收口并避免遗留活动请求。
- 收紧 SSE 外部 JSON 的 schema 校验、非负 usage 上限和 API URL 凭据/query/hash 拒绝，避免畸形 Provider 数据或带凭据地址进入运行时。
- 修复 session/local 模式切换在当前 Origin 没有可迁移的 session Key 时可能遗留旧 Vault Key 的问题；空输入现在会显式清除同 Origin 的 stale Key，并保留其他 Origin 的密钥。
- 收紧实验性 CSS Custom Highlight 路径：Highlight 仅用于可选的源范围装饰，译文始终由相邻纯文本节点显示；策略切换、单节点失效、构造失败和根节点清理都会移除旧范围，避免静默漏译或遗留状态。
- 修复选区翻译在首次隐私确认未完成时只显示通用失败的问题；现在会按当前界面语言明确提示用户先在 Popup 或 Options 确认隐私说明。
- 修复选区译文或错误提示插入表格单元格等正文容器后，被后续动态扫描再次当作源文本提交的问题；选区专属节点现在与整页译文一样从正文快照和变更观察中排除。
- 修复同一流式 Port 顺序发送多个批次时后续批次无法被“停止翻译”取消的问题；每个批次现在拥有独立的端口控制器，端口关闭后也不会接受新请求。

### Security

- 收紧可信 Options 到 Service Worker 的自定义界面语言批次：最多 50 个键、单键最长 128 个字符、单值最长 4,000 个字符、批次总字符数最多 64,000，超限消息在运行时校验阶段拒绝。

### Changed

- CI 与 Release 增加锁定 Playwright 版本的本地浏览器冒烟门禁；新增受限的原创 HTML 夹具服务，验证 active/inactive 往返、加密缓存命中与清理不会依赖外部网站或真实 Provider。
- 0.2.0 起 TextDuet 跳过 0.1.0 / 0.1.1，直接发布完整重设计版。
- 0.2.0 起 Options 页从「7 卡片垂直堆叠」重构为「Sidebar + 主区」,4 大段:语言 / 模型 / 用量 / 高级。
- 0.2.0 起设计 token 从 v1.0(13 变量)升级到 v2(6 语义色族 × 5 档 shade + 11 档字号 + 6 档圆角 + 5 档阴影 + 11 档间距 + 7 档图标尺寸);warm-craft 家族延续(品牌 brief 明示 override)。
- 0.2.0 起图标库从 `lucide-react` 切换为手设计 SVG 套件(`src/icons/`,40+ 图标,24×24 viewBox,1.5px stroke,currentColor 单色);零运行时依赖增量。
- 0.2.0 起状态徽标升级为 `td-badge` v2(图标 + 文字 + 颜色三重指示,WCAG AA)。
- 0.2.0 起 Popup 与网页状态条按 v2 token 同步重新着色。
- 0.1.1 起的 header 弹窗开关 / 模型 per-origin 独立 / `[role="banner"]` 选择器扩展全部继承(未回退)。
- 0.2.x 起翻译子系统按 `TD-2026-026` 7 Layer 升级:SiteProfile 嗅探 8 种 web 架构(SSR / SPA / Streaming SSR 含 RSC / SSG-ISR / PWA-SW / MPA / Islands / Hybrid);Strategy Registry + Dispatcher(委派 fallback 策略,后续按 profile 分支);DOM Extraction 2.0 用 TreeWalker 替代 `querySelectorAll`,加 IntersectionObserver 视口预翻译 200px + async SHA-256 内容哈希;Modern Observation 用 `scheduler.postTask` 替代 `setTimeout` + `AbortController` 取消在途;当前 Translation Memory 仅在页面运行期间使用 L1 WeakMap / L2 Map，跨标签与持久复用由 Service Worker 管理的加密译文缓存负责（未启用浏览器端 `chrome.storage.local` 或 `BroadcastChannel` 记忆层）;Smart Insertion 3 策略 `adjacent`(默认) / `highlight`(CSS.highlights 源范围装饰,译文仍由 adjacent 纯文本节点显示) / `range-replace`(Range API);SPA Reset 2.0 加 View Transitions API + `astro:before-swap` 监听 + generation 边界取消迟到结果。零新增运行时依赖。
- 实验性 `highlight` 策略不改变可见译文的纯文本渲染契约；不支持或异常时自动回退 adjacent，并按 source owner 重建/清理聚合范围。

## [0.2.0] (已合并到 0.2.x 升级版，未发布草案)

## [0.1.0] - 2026-08-24(已合并到 0.2.0,未发布)

> ⚠️ 0.1.0 标签从未实际发布,2026-08-26 项目所有者决定跳过此版本,合并入 0.2.0 完整重设计版。下文保留为历史规格摘要,不视为「已对外发布」的功能清单。

首版 `0.1.0` 本地安装版。配套 Git tag 与 GitHub Release 仅在项目所有者明确授权后创建；本仓库在此之前不得声明已“对外发布”。本版不进入 Chrome Web Store、其他商店或自动更新分发。

### Added

- Chrome Manifest V3 的 Popup、Options、Service Worker 与按需网页翻译脚本。
- 用户自带 OpenAI Chat Completions 兼容 API Base URL、API Key 和模型名称。
- 阿里云百炼 Qwen、OpenAI、DeepSeek、OpenRouter、硅基流动预设及自定义兼容端点。
- 会话级或本机级密钥保存、API Origin 按需授权和连接测试。
- 当前网页可见阅读内容提取、分批翻译、双语纯文本插入和停止控制。
- 用户启动翻译后自动监听当前页面滚动加载的新正文，增量去重翻译；停止后断开监听。
- 请求超时、有限重试、逐批进度和常见 Provider 错误分类。
- 翻译前 token/费用区间预估、实际 usage 优先结算和 IndexedDB 每日用量账本。
- 50%、80%、100% 本地每日预算提醒，以及手动模型价格与预算配置。
- 已知 Provider 的官方价格入口、核对日期与适用提示；数字价格仍由用户手动维护且默认关闭。
- 最近 60 天输入/输出 token 折线图，按本地日期补齐数据并根据用量量级切换 Y 轴单位。
- OpenRouter 官方模型列表价格适配；精确匹配当前模型后展示输入/输出每百万 token 单价。
- DeepSeek 官方余额接口适配；用户主动查询后展示当前充值与赠送余额，不持久化余额。
- 内容寻址的本地译文缓存，支持 30 天有效期、50 MiB 上限、LRU 淘汰、占用摘要和手动清理。
- P0 公开网站兼容矩阵脚本，使用 Chrome + Mock Provider 验证框架文档、海外社区、创意设计内容、README 和学术页面；只输出脱敏计数和环境失败类别。
- 隐私政策草案、Chrome 权限说明、开发者安装文档、扩展图标和一键发布候选检查。
- Options 增加本地兼容性诊断预览与下载；支持问题类型选择和用户明确同意后包含页面路径。
- Popup 支持双语、仅原文和仅译文三种页面显示模式；Options 可设置默认显示方式和译文文字颜色，颜色输入支持十六进制、RGB 与 RGBA。
- 同一模型服务商可保存多个模型名称/code，并在 Popup 中切换当前模型。
- 译文颜色按区块分析原文色、有效背景色和偏好色；模型只能在两个候选中建议，本地对比度门禁在颜色相近时优先回退原文色。
- Token 用量按模型提供最近 60 天的每日输入/输出曲线和各模型汇总，不改变现有本地账本结构。
- Options 多模型配置改为回车/逗号生成标签，支持点击切换当前模型和单独删除。
- Popup、Options、用量图和网页状态提示统一为暖纸色、赤陶色与赭石色主题，并同步更新扩展图标；主题只改变界面表现，不改变权限、Key 存储或 Provider 数据流。
- Popup 支持“当前语言 → 翻译到”语言对配置；目标语言可跟随系统，源语言可自动检测或手动指定。
- 网页翻译不再注入右下角状态浮层；状态保留在扩展 Popup 中。
- OpenAI-compatible Provider 支持 SSE 流式响应；响应按 chunk 读取并在完整批次校验后原子显示，普通 JSON 响应在同一次请求中回退解析。
- 增加“翻译选中文本”右键菜单，选区译文以内联纯文本形式插入并复用本地缓存。
- 选区译文复用用户配置的译文颜色和可读性安全门；可在 Popup/Options 开关选区快捷图标。
- 首批翻译采用小批次并与成本预估并行；模型响应完整校验后按批次原子显示，语言选择改为共享弹出式控件。
- 流式批次完成时增加整批幂等回显，兼容缓冲式 SSE 服务，并避免异常/断流留下部分译文。
- 页面候选提取覆盖页头、导航标签与页脚正文链接，同时继续排除按钮、表单、代码和隐藏区域。
- 选区快捷翻译监听 pointer/mouse/touch 结束事件并采用视口固定定位；图标改为简洁的“文A”双语标识，降低页面样式污染和定位抖动。
- 选区快捷翻译改为默认关闭；用户明确打开开关后才向当前页面按需注入入口，并增强选区稳定检测与多行选区定位。
- 修复空选区事件的隐藏窗口误抑制后续真实划词，确保无效选区只隐藏按钮，不阻断下一次检测。
- 修复选区结束后的空选区事件误清理监听器，避免快捷图标只偶尔出现；普通 `div/section` 文本容器现在也可作为安全选区锚点。
- 修复 Popup 语言方向组件的网格错位、箭头换行和内部文字样式污染；统一 Options 语言、显示、颜色与快捷开关的对齐。
- 重新设计扩展图标为"双子 T"：暖纸底 + 粗体赤陶 T + 下方赭石小 t 回响；保留既有色彩 token，规避装饰性渐变/光球；16/32/48/128/512 五档均保持 T 形可辨。

### Changed

- M2 增加 GitHub、框架文档、海外社区和创意设计站的保守本地提取规则；未知站点保持通用提取回退。
- 兼容性诊断默认只关联最近一次翻译的标签页，诊断包不自动上传；截图采集和反馈提交仍未开放。
- 首版交付方式收敛为 Chrome 开发者模式本地加载；Chrome Web Store、其他商店和自动更新不属于当前范围。
- 默认网站矩阵优先选择无需权限即可访问的海外社区、框架技术文档和创意设计站；访问受限页面只保留环境记录，不计入默认目标。
- Popup 与 Options 账单区域只展示 token 用量，不再把插件计算金额作为账单展示；查不到官方结构化价格时隐藏数字价格。
- 本地 token 历史只记录 Provider 响应返回的实际 usage；缺失 usage 时仍可显示本次预估，但不再写入账本。旧版含估算聚合记录会在维护时清理。
- Popup 将翻译与停止合并为一个状态按钮，并在页面完成后同步恢复为翻译操作；再次点击翻译会绕过缓存重新请求，显示模式切换不会产生模型请求。
- Options 统一为暖色视觉、约 14px 卡片圆角、稳定字段栅格和一致操作区，桌面与窄屏保持相同的信息层级；Popup 延续紧凑工具栏布局。
- M2 的公开页面周期回归进入 TD-2026-018；回归使用本地 Mock Provider，并将网站访问环境失败与插件产品失败分开记录。
- TD-2026-018 已完成：项目所有者完成 Chrome 安装态验收；公开页面回归工具保留 Service Worker 环境失败的结构化记录，不把环境失败冒充产品通过。
- TD-2026-020 已完成：项目所有者完成 Chrome 安装态验收；批次即时回显、header/navigation/footer 召回与选区快捷图标默认行为按预期生效。

### Fixed

- 修复 SPA 壳层中相同文本节点的去重策略：每个真实可见 DOM 节点都会渲染自己的译文；本地翻译记忆只复用已验证的译文内容，并会绑定到当前节点，避免相同导航标签漏译或缓存命中后不显示。
- 收紧泛化 DOM 候选的交互与隐藏内容边界：按钮、原生/ARIA 控件、`summary`、可编辑区域、搜索区域及其外层聚合容器不再进入翻译；普通导航链接和安全阅读文本仍可提取。
- 修复独立打开 Options 或 Popup 扩展标签页时可信来源识别失败，导致配置保存请求被错误拒绝的问题。
- 修复翻译流式进行中页面进入 bfcache / 导航时 `port.postMessage` 抛错被降级为 `Unchecked runtime.lastError` 的噪音；Service Worker 端加入 `safeStreamPostMessage` 与端口断连分类，clean 关闭静默、bfcache/navigation 写入本地 `console.warn` 诊断。
- 优化阿里云 Qwen3 兼容请求：翻译场景关闭思考模式，将默认批次收紧为 4000 字符，并将默认单请求超时调整为 60 秒，降低长文章翻译超时。
- 修复虚拟列表复用节点在离线改写后再次插入时可能复用旧源文本的问题；Observer 改为监听文档根节点，并排除通用 breadcrumb、侧栏和搜索区域。
- 修复动态页面仍有待扫描 DOM 时过早显示“已完成”，导致调用方可能把中间状态当作最终结果的问题。
- 修复网页翻译完成或停止提示长期停留的问题，完成与停止提示会自动消失。
- 修复 Chroma Research 正文目录直接链接未进入翻译候选的问题，同时保持站点顶部导航排除。

### Security

- API Key 仅由可信扩展上下文读取，不回填给 Popup/Options，不进入内容脚本或网页 DOM。
- 模型输出经过结构校验并仅作为纯文本渲染。
- 安装时不注册静态全站内容脚本，Provider Origin 在用户触发时按需申请。

## 发布维护规则

1. 用户可见的新增、变化、修复、弃用、移除和安全修复先写入 `Unreleased`。
2. 内部重构、单纯测试补充和不影响使用者的文档调整通常只写入迭代记录。
3. 正式发布时，把对应条目移动到 `## [x.y.z] - YYYY-MM-DD`；同一变化不得同时留在 `Unreleased` 和已发布版本。
4. 版本章节必须能对应实际发布物和 Git tag。没有发布动作时不得预填发布日期。
5. 破坏性变化必须单独标记 `Changed` 或 `Removed`，并提供迁移说明。
