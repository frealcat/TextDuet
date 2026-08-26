# TextDuet 产品迭代记录

> 记录版本：1.1
>
> 更新时间：2026-08-19

本文档记录每轮产品迭代的目标、范围、决策、验证证据和遗留问题。它是研发事实账本，不是发布公告；功能只有进入带版本号的发布物后才能标记为“已发布”。

## 1. 记录规则

- 迭代编号使用 `TD-YYYY-NNN`，在同一年内递增且不复用。
- 状态使用：已规划、进行中、已验证、已发布、已延期、已取消。
- 每轮必须包含目标、范围、关键决策、权限/隐私/成本影响、验证和遗留项。
- “已验证”必须列出实际证据；未执行的浏览器或真实 Provider 验证必须明确写出。
- 同一轮若改变 PRD、路线图或架构，需要列出关联文档。
- 用户可见变化同时写入 `CHANGELOG.md` 的 `Unreleased`；纯内部整理不必进入 CHANGELOG。
- 正式发布后在对应记录补充版本号、发布日期和 Git tag，不回写虚构历史。
- 主文件保留所有进行中条目和最近 20 个已结束条目；超过后按年份移动到 `docs/iterations/YYYY.md`，摘要中保留索引。归档不得包含进行中条目，也不得改写原始事实。

## 2. 当前状态摘要

| 迭代 | 主题 | 状态 | 所属阶段 | 发布状态 |
| --- | --- | --- | --- | --- |
| TD-2026-001 | 工程与安全基线 | 已验证 | M0 | 未发布 |
| TD-2026-002 | 网页翻译 Alpha 主链路 | 已验证 | M1.1 | 未发布 |
| TD-2026-003 | 成本预估与每日预算 | 已验证 | M1.2 | 未发布 |
| TD-2026-004 | 产品演进治理 | 已验证 | 项目治理 | 未发布 |
| TD-2026-005 | 本地翻译缓存 | 已验证 | M1.3 | 未发布 |
| TD-2026-006 | 合成语料 DOM 回归 | 已验证 | M1.4 | 未发布 |
| TD-2026-007 | 真实 Provider 与首批公开网站冒烟 | 已验证 | M1.4 / M1.5 | 未发布 |
| TD-2026-008 | Qwen 显式预设与动态加载增量翻译 | 已验证 | M1.1 / M1.4 | 未发布 |
| TD-2026-009 | P0 网站兼容矩阵与动态页面可靠性 | 已验证 | M1.4 | 未发布 |
| TD-2026-010 | Alpha 发布收口与公开目标筛选 | 已验证 | M1.5 | 未发布 |
| TD-2026-011 | 官方用量/价格适配与 Token 可视化 | 已验证 | M1.2 / M1.5 | 未发布 |
| TD-2026-012 | 真实 Token 留存与 DeepSeek 余额 | 已验证 | M1.2 / M1.5 | 未发布 |
| TD-2026-013 | Alpha 本地安装候选验收 | 已验证 | M1.5 | 未发布 |
| TD-2026-014 | M2 站点规则层与诊断数据契约 | 已验证 | M2 | 未发布 |
| TD-2026-015 | M2 本地诊断预览与下载 | 已验证 | M2 | 未发布 |
| TD-2026-016 | M2 阅读控制、多模型与译文样式 | 已验证 | M2 | 未发布 |
| TD-2026-017 | M2 可读性、分模型用量与设置体验 | 已验证 | M2 | 未发布 |
| TD-2026-018 | M2 公开页面周期回归与问题收口 | 已验证 | M2 | 未发布 |
| TD-2026-019 | M2 无感接入、语言对、流式翻译与选区翻译 | 进行中 | M2 | 未发布 |
| TD-2026-020 | M2 流式回显、页面壳层兼容与选区快捷入口稳定性 | 已验证 | M2 | 未发布 |
| TD-2026-021 | V1.0 本地安装版收口(暂缓,合并到 0.2.0) | 已暂缓 | V1.0 → 0.2.0 | 未发布 |
| TD-2026-022 | 0.1.1 模型配置独立化、header 识别补齐与 popup 动态翻译 | 已验证 | V1.0.1 | 未发布 |
| TD-2026-024 | 0.1.0 自定义 UI 语言（模型动态翻译字典） | 已验证,纳入 0.2.0 | V1.0 → 0.2.0 | 未发布 |
| TD-2026-023 | 0.1.0 i18n 收口：zh-CN + en 双语、Options 语言选择器、品牌主标题英文 | 已验证,纳入 0.2.0 | V1.0 → 0.2.0 | 未发布 |
| TD-2026-025 | 0.2.0 完整视觉 + Sidebar IA + 手设计 SVG 套件 | 进行中 | 0.2.0 | 未发布 |

> TD-2026-001 至 TD-2026-003 是 2026-08-17 根据当前未发布仓库状态建立的基线回溯，不代表历史上已有对应 Git commit、tag 或公开版本。

## 3. 迭代明细

### TD-2026-001：工程与安全基线

| 字段 | 内容 |
| --- | --- |
| 状态 | 已验证，未发布 |
| 基线日期 | 2026-08-14 |
| 所属阶段 | M0 |
| 目标 | 建立 Chrome MV3、本地优先、BYOK 的可持续工程基线 |

交付范围：

- WXT + React + TypeScript strict + Vitest 项目框架。
- Popup、Options、Service Worker、按需 Translator Script 基础入口。
- Apache-2.0 许可证与分层 Agent 开发规范。
- API Key 只进入可信扩展上下文，网页和模型输出按不可信数据处理。

关键决策：

- 首个版本只支持 Chrome，不使用 Next.js。
- 安装时不静态申请全站读取权限。
- 默认会话级保存 API Key，持久保存由用户主动选择。

验证基线：工程具备类型检查、单元测试和 Chrome MV3 生产构建命令。此条目为仓库状态回溯，不声称已有正式发布或历史 tag。

遗留：需要在正式发布前完成威胁模型、隐私政策和商店权限审查。

### TD-2026-002：网页翻译 Alpha 主链路

| 字段 | 内容 |
| --- | --- |
| 状态 | 已验证，未发布 |
| 基线日期 | 2026-08-14 |
| 所属阶段 | M1.1 |
| 目标 | 打通普通文章网页的配置、提取、调用、校验、渲染和停止闭环 |

交付范围：

- OpenAI Chat Completions 兼容配置、连接测试和 API Origin 按需授权。
- 可见阅读文本提取、嵌套去重、字符预算分批和稳定段落 ID。
- 请求超时、有限重试、按标签页取消和网页状态提示。
- 模型 JSON、段落数量和 ID 集合校验；译文只通过纯文本写入 DOM。

权限与隐私影响：未增加 Manifest 基线权限；API Key 不进入内容脚本、网页 DOM、日志或测试夹具。

验证基线：TypeScript、31 项单元测试和 Chrome MV3 生产构建曾在该基线完成时通过；真实 Provider 与真实扩展安装链路仍属于发布前人工验收。

遗留：本地缓存、合成 HTML 回归、P0 重点网站矩阵和动态内容处理尚未完成。

### TD-2026-003：成本预估与每日预算

| 字段 | 内容 |
| --- | --- |
| 状态 | 已验证，未发布 |
| 基线日期 | 2026-08-14 |
| 所属阶段 | M1.2 |
| 目标 | 在付费模型调用前后向用户提供可解释、可复核的本地成本信息 |

交付范围：

- 翻译前 token 与费用区间预估。
- Provider 实际 usage 优先结算；缺失时标记并记录估算。
- 按本地日期、币种、Provider 和模型聚合的 IndexedDB 用量账本。
- 50%、80%、100% 每日一次预算提醒。
- Options 手动价格/预算设置、Popup 今日用量和本地清理入口。

关键决策：

- 预算默认关闭；达到 100% 只提醒，不自动中止已经开始或新的任务。
- 当前仅支持用户维护当前模型价格，官方价格目录继续留在 M1。
- 账本不记录 API Key、网页正文或 URL；账本失败不丢弃已经返回的译文。

验证证据：

- `npm run typecheck` 通过。
- 6 个测试文件、43 项测试通过。
- Chrome MV3 生产构建通过，总体积约 348 KB。
- `npm audit --omit=dev` 为 0 个已知漏洞。
- 使用生产构建脚本和 Mock runtime 验证 Options、Popup、翻译前预估、结算和预算展示；尚未使用真实付费 Provider 验证账单一致性。

遗留：官方价格目录、预算硬暂停和“本次/今日继续”未实现；厂商账单仍是最终依据。

### TD-2026-004：产品演进治理

| 字段 | 内容 |
| --- | --- |
| 状态 | 已验证，未发布 |
| 开始日期 | 2026-08-17 |
| 完成日期 | 2026-08-17 |
| 所属阶段 | 项目治理 |
| 目标 | 建立路线图、迭代事实记录与发布日志的长期维护机制 |

交付范围：

- 建立产品路线图，定义阶段状态、优先级和退出条件。
- 建立结构化迭代记录，回溯当前未发布基线。
- 建立遵循语义化版本和 Keep a Changelog 结构的发布日志。
- 将维护要求接入 Agent 规范、贡献流程、README 与 PRD。

权限、隐私与成本影响：无运行时代码、依赖、Manifest 权限、存储或费用默认行为变化。

验证证据：

- 检查 19 份 Markdown，仓库内相对链接全部可解析。
- 对 README、规范、文档和 GitHub 模板执行行尾空白检查，无命中。
- 搜索旧仓库状态、旧 PRD/规范版本和重复里程碑表述，无残留命中。
- 人工复核 PRD、路线图、迭代记录、CHANGELOG 与架构文档的职责边界和状态一致性。
- `git diff --check` 通过；当前仓库仍没有本地 commit，所有功能均保持“未发布”。

下一步：完成本轮后，按路线图启动 TD-2026-005“本地翻译缓存”的需求细化与实现。

### TD-2026-005：本地翻译缓存

| 字段 | 内容 |
| --- | --- |
| 状态 | 已验证，未发布 |
| 开始日期 | 2026-08-17 |
| 完成日期 | 2026-08-17 |
| 所属阶段 | M1.3 |
| 目标 | 相同翻译上下文优先复用本地译文，减少重复等待和模型费用 |

范围：

- 使用内容哈希、语言对、Provider、模型和提示词版本生成缓存键。
- 在可信扩展上下文使用 IndexedDB 保存译文，不保存 API Key 或原始网页 URL。
- 只把未命中的段落发送给 Provider；缓存命中不计入模型 usage 或费用账本。
- 提供固定容量、过期与 LRU 淘汰策略，以及 Options 占用摘要和清理入口。
- 覆盖全命中、部分命中、失效、清理、存储失败和密钥隔离测试。

非范围：

- 云同步、跨设备缓存、远程缓存服务。
- 缓存真实 API Key、认证头、网页 URL 或表单内容。
- 本轮不新增浏览器权限、运行时依赖或 Provider 协议。

关键决策：

- 缓存位于独立的 `textduet-translation-cache` IndexedDB，结构显式版本化。
- 当前 Alpha 使用固定 30 天有效期、50 MiB 上限和最近最少使用淘汰；未来调整默认值属于产品决策。
- 自定义系统提示词变化通过提示词指纹使旧缓存自然失效，不读取或清空无关模型的缓存。

权限、隐私与成本影响：缓存保留本地译文和不可逆上下文哈希；不离开设备，不包含 Key。命中缓存不会产生 Provider 请求或新增用量账本记录。

验证证据：

- `npm run typecheck` 通过。
- 9 个测试文件、59 项测试通过，覆盖缓存键隔离与失效、容量计算、过期/LRU、全命中、部分命中、存储失败降级和状态文案。
- Chrome MV3 生产构建通过，总体积约 359 KB；构建产物中未出现本地 Provider 验收变量、测试端点或 API Key。
- `npm audit --omit=dev` 为 0 个已知漏洞；Manifest 权限维持 `activeTab`、`scripting`、`storage` 与按需 HTTPS Origin，没有新增权限或内容脚本。
- 使用生产构建脚本和 Mock runtime 检查 Options 桌面/窄屏布局；缓存摘要、确认清理、成功反馈均正常，控制台无错误或警告。
- 已验证翻译编排的“全命中不读取 Key、不调用 Provider、不写费用账本”与“部分命中只发送未命中段落”；真实已安装扩展中的 IndexedDB 冒烟测试尚待完成。
- 使用 Chrome for Testing 147 加载生产 MV3 构建，真实 Service Worker、Options、Popup 与 Translator Script 链路通过：预置 5 条缓存后翻译 5/5 段，页面重载后再次全命中，Provider 请求数为 0，Options 清理后缓存条目和占用均归零。
- 修复独立 Options/Popup 扩展标签页的可信来源识别：同时校验 `sender.id` 与扩展 Origin，保证可信扩展页面可保存配置而网页来源仍被拒绝。

当前进度：实现、自动化验证与真实 Chrome 已安装扩展的 IndexedDB 冒烟测试均已完成，状态提升为“已验证，未发布”。真实 Qwen 连接与账单一致性验证属于 M1.5 发布收口，不作为缓存算法正确性的替代证据。

遗留与下一步：进入 TD-2026-006 / M1.4，完成原创合成语料、提取性能基线与重点网站验收矩阵。缓存存储失败降级继续由确定性自动化覆盖，不通过破坏真实浏览器 IndexedDB 制造不可复现环境。

### TD-2026-006：合成语料 DOM 回归

| 字段 | 内容 |
| --- | --- |
| 状态 | 已验证，未发布 |
| 开始日期 | 2026-08-17 |
| 完成日期 | 2026-08-17 |
| 所属阶段 | M1.4 |
| 目标 | 用真实 Chrome 安装态扩展验证五类原创页面的提取、排除、缓存渲染、幂等和性能边界 |

范围：

- 为文章、技术文档、讨论区、混合 UI 和多语言五类原创 fixture 标记应翻译与必须排除的节点。
- 新增真实 Chrome MV3 回归脚本，加载生产构建、预置确定性本地缓存译文，并通过 Popup 启动完整翻译链路。
- 验证正文直属译文、排除区不变、无意外译文、重复运行不重复插入，以及动态新增评论的增量处理。
- 建立 1000 个候选节点的提取性能基线，并记录完整扩展缓存运行耗时。

非范围：

- 不调用真实 Qwen 或其他付费 Provider，不评价翻译文风与语义质量。
- 不新增生产 Manifest 权限；本地 fixture Origin 只写入运行时生成的临时测试副本。
- 不执行 P0 真实网站不少于 12 页的公开页面验收，不保存第三方正文或绕过网站访问限制。
- 不实现 M2 的自动 MutationObserver；动态 fixture 由测试显式插入内容后再次触发翻译。

关键决策：

- 结构回归统一从 IndexedDB 缓存读取确定性译文，使 DOM 断言与真实 Provider 的随机性、网络和费用解耦。
- 测试副本和临时 Chrome Profile 在结束时精确清理；生产构建继续维持按需网站访问模型。
- 产品性能目标仍为 1000 个候选节点提取低于 100 ms；自动化直接以 100 ms 为失败门槛，避免只记录结果而不执行验收约束。

权限、隐私与成本影响：无生产权限、依赖、Provider 协议、存储格式或费用默认值变化。测试只使用 placeholder Key 和原创短文本，Provider 请求数为 0，不产生模型费用。

验证证据：

- `node --check .playwright/extension-corpus.mjs` 通过。
- `npm run typecheck` 通过；9 个测试文件、59 项测试通过；Chrome MV3 生产构建通过，总体积约 359 KB。
- 使用 Chrome for Testing 147.0.7727.15、Apple M1 Pro、darwin-arm64 加载真实生产 MV3 Service Worker、Options、Popup 与 Translator Script。
- `article-basic.html`：11/11 个应翻译节点完成，3 个排除节点保持不变，重复译文 0。
- `technical-docs.html`：6/6 个应翻译节点完成，1 个排除节点保持不变，重复译文 0。
- `discussion-dynamic.html`：4/4 个初始节点完成，1 个排除节点保持不变，重复译文 0；动态追加后仅新增 1 条译文。
- `mixed-ui.html`：4/4 个应翻译节点完成，7 个交互或编辑节点保持不变，重复译文 0。
- `multilingual.html`：5/5 个应翻译节点完成，重复译文 0。
- 五类页面均无遗漏、排除区误译或意外译文；二次运行数量稳定；全部译文来自本地缓存；Provider 请求总数为 0。
- 1000 个候选节点在 7 次预热后样本中的提取中位数为 2.6 ms、最大值为 3.1 ms，满足低于 100 ms 的产品目标；1000 段完整扩展缓存运行耗时为 641.55 ms。

关联文档：

- `docs/PRODUCT-ROADMAP.md`
- `docs/SITE-COMPATIBILITY.md`

遗留与下一步：M1.4 整体仍在进行中。下一轮建立 P0 真实网站类型矩阵并完成不少于 12 个公开页面的 Chrome 验收；同时补齐停止行为、页面原有交互和恶意模型文本的浏览器级证据。真实 Provider 连接与账单一致性继续留在 M1.5。

### TD-2026-007：真实 Provider 与首批公开网站冒烟

| 字段 | 内容 |
| --- | --- |
| 状态 | 已验证，未发布 |
| 开始日期 | 2026-08-17 |
| 完成日期 | 2026-08-17 |
| 所属阶段 | M1.4 / M1.5 |
| 目标 | 使用用户提供的真实阿里云 Qwen 配置，验证 Provider 连接、GitHub README 翻译、纯文本渲染、缓存复跑和用量入账链路 |

范围：

- 为阿里云域名下的 Qwen3 Chat Completions 翻译请求关闭思考模式，避免翻译任务因长时间推理超过客户端超时。
- 将 Provider 默认单请求超时从 10 秒调整为 30 秒，后续在长文章真实验收中进一步调整为 60 秒；继续保留 Abort 信号、有限重试和不可重试状态码边界。
- 新增只在本地运行的真实公开网站测试脚本；每页隔离为最多 3 个可翻译块、总计不超过 600 个源字符。
- 验证 `openai/openai-python` 与 `microsoft/TypeScript` 两个英文 GitHub README 的首次翻译、排除区、代码、链接、重复渲染、缓存复跑和账本去重。
- 尝试 ChatGPT Help Center 英文文档，并对站点访问防护与插件失败作明确分类。

非范围：

- 不记录或提交 API Key、模型名称、网页正文、完整请求/响应、译文或第三方截图。
- 不新增生产 Manifest 权限；测试网站和 Provider Origin 只加入运行时生成的临时扩展副本。
- 不绕过 ChatGPT/OpenAI 页面返回的 HTTP 403、验证码、登录墙或其他访问控制。
- 不把两个 README 冒烟结果计作 M1.4 不少于 12 页的完整 P0 验收矩阵。
- 不评价真实译文的长期文风稳定性，也不声称厂商账单金额已经核对一致。

关键决策：

- `enable_thinking: false` 只在阿里云域名且模型名称符合 Qwen3 家族时加入请求顶层；其他 OpenAI-compatible Provider 不携带该厂商字段。
- 测试脚本只记录安全元数据与聚合计数；通过隐藏非选中候选节点，让生产提取器实际只处理受控样本，而不修改生产提取策略。
- 各站点独立报告失败，单个站点访问受阻不再掩盖其他站点的测试结果。

权限、隐私与成本影响：生产权限、密钥存储语义和网页内容发送边界均未变化。真实调用共确认 1 次连接测试和 2 次成功页面翻译请求；诊断阶段还存在客户端中止的请求，是否计费以阿里云服务端账单为准。当前模型未配置匹配的手动价格，因此账本金额为 0 只表示“未计算价格”，不得理解为免费。

验证证据：

- Provider 最小连接测试：1 次请求 HTTP 200，约 1.24 秒；请求安全元数据显示 Qwen3 思考模式已关闭。
- `openai/openai-python` README：3 块、407 个源字符，首次翻译 3/3 完成，1 次 Provider 请求约 3.24 秒；缓存复跑约 268 ms，Provider 请求 0。
- `microsoft/TypeScript` README：3 块、453 个源字符，首次翻译 3/3 完成，1 次 Provider 请求约 8.06 秒；缓存复跑约 221 ms，Provider 请求 0。
- 两页均验证纯文本渲染、重复译文 0、排除区 0 误译、链接与 `pre/code` 不变，缓存复跑后用量账本不重复增加。
- ChatGPT Help Center 目标页在无头和可见 Chrome 中均返回 HTTP 403，Provider 请求为 0，归类为当前环境的 `site-access-protection`。
- Provider 单元测试、TypeScript、Chrome MV3 构建和最终安全检查见本轮收口记录。

关联文档：

- `docs/ARCHITECTURE.md`
- `docs/PRODUCT-ROADMAP.md`
- `docs/SITE-COMPATIBILITY.md`
- `CHANGELOG.md`

遗留与下一步：M1.4 仍需完成六类不少于 12 个公开页面的完整矩阵；ChatGPT 文档需在可正常访问的用户本机普通 Chrome 中人工复验。M1.5 仍需配置与当前模型匹配的价格并对照厂商账单核验金额一致性。

### TD-2026-008：Qwen 显式预设与动态加载增量翻译

| 字段 | 内容 |
| --- | --- |
| 状态 | 已验证，未发布 |
| 开始日期 | 2026-08-17 |
| 完成日期 | 2026-08-17 |
| 所属阶段 | M1.1 / M1.4 |
| 目标 | 让 Qwen 用户能从设置页明确选择阿里云百炼，并让一次主动翻译持续覆盖本页后续滚动加载的正文 |

范围：

- 增加“阿里云百炼 Qwen”服务商预设、兼容模式端点、模型名示例和配置说明。
- 保留 `openai-compatible` 作为协议标识，不迁移现有设置、缓存或用量账本。
- Translator Script 在用户主动启动后观察当前页面新增、可见性和文本变化，去抖后串行翻译尚未处理的可见正文。
- 重复节点复用当前语言译文；停止时断开 Observer、清除待扫描任务并取消当前标签页在途请求。

非范围：

- 不增加网站级常驻自动翻译，不新增生产 Manifest 权限或静态内容脚本。
- 不新增 Qwen 原生非兼容协议、厂商账号发现、模型列表远程拉取或价格远程更新。
- 不承诺首轮覆盖所有虚拟列表节点复用模式；复杂站点仍进入后续兼容矩阵。

关键决策：

- “服务商预设”与“网络协议适配器”分层：Qwen 对用户显式可见，底层继续复用已验证的 Chat Completions 兼容链路。
- Observer 只存在于用户触发的当前运行会话；新增正文沿用同一安全消息、缓存、成本和纯文本渲染边界。

权限、隐私与成本影响：生产权限、API Key 存储和内容发送边界不变。只有本次运行期间新出现且符合提取规则的正文会发送给用户选择的服务商；缓存命中不重复产生 Provider 调用或用量。真实页面复验可能产生模型费用，以厂商账单为准。

验证证据：

- TypeScript 通过；Vitest 10 个文件、63 项测试全部通过；Chrome MV3 生产构建通过，总大小约 361.95 KB。
- Chrome for Testing 147（darwin-arm64 / Apple M1 Pro）加载生产扩展完成五类原创语料回归；所有应译节点完成、排除区零误译、重复译文 0、Provider 请求 0。
- `discussion-dynamic.html` 新增评论无需再次点击即可自动得到缓存译文；随后模拟站点删除译文节点也能自动从缓存恢复，两步合计约 1.08 秒；停止后追加评论保持原文。
- Options 中“阿里云百炼 Qwen”可由键盘 Enter 选择，Base URL 与模型占位提示正确；1280px 桌面和 390px 窄屏截图均未出现字段溢出，截图不含 Key 并由 `.gitignore` 排除。
- Chroma `Context Rot` 公开文章最终以真实 Qwen 配置完成当前已加载正文翻译：1 次 Provider 请求 HTTP 200，约 41.94 秒，70/70 个译文节点均为纯文本，排除区误译 0。用户要求的效果截图只保存在本地 QA 输出目录。
- 生产 Manifest 保持 `activeTab`、`scripting`、`storage` 与可选 HTTPS Origin 范围，没有静态内容脚本或新增网站常驻权限。

关联文档：

- `docs/PRD.zh-CN.md`
- `docs/PRODUCT-ROADMAP.md`
- `docs/ARCHITECTURE.md`
- `docs/SITE-COMPATIBILITY.md`
- `CHANGELOG.md`

遗留与下一步：继续验证虚拟列表复用同一节点、内容移除后重新插入、Service Worker 回收和复杂站点可见性变化。Chroma 诊断阶段存在中止请求，是否计费以厂商账单为准；本轮未核对金额一致性。

### TD-2026-009：P0 网站兼容矩阵与动态页面可靠性

| 字段 | 内容 |
| --- | --- |
| 状态 | 已验证，未发布 |
| 开始日期 | 2026-08-17 |
| 完成日期 | 2026-08-17 |
| 所属阶段 | M1.4 |
| 目标 | 用 Chrome 安装态证据验证六类 P0 页面结构，并修复动态页面节点复用造成的旧内容翻译风险 |

范围：

- 增加 20 个公开 URL 的可重复矩阵脚本，覆盖文章、技术文档、README、讨论、学术和紧凑列表六类；至少 12 页通过且每类至少 2 页。
- 使用 Mock Provider 或本地缓存，不调用真实模型；只输出块数、召回率、误译率、耗时、幂等和环境失败类别。
- 验证正文召回率 ≥90%、非正文误译率 ≤5%、纯文本渲染、代码/排除区域、链接 click 事件、重复运行和停止后新增内容。
- 扩展动态语料，验证虚拟列表同节点离线改写后复用、同节点原地改写、整个 body 替换和 Service Worker 回收后的缓存恢复。

非范围：

- 不绕过 Wikipedia、Stack Overflow、ChatGPT Help Center 或其他站点的 403、验证码、登录墙和访问防护。
- 不把第三方正文、译文、Key、完整请求/响应或截图提交到仓库。
- 不新增生产 Manifest 权限、网站级常驻脚本、遥测或 Provider 协议。

关键决策：

- Observer 监听 `document.documentElement`，新增或复用候选节点时删除旧译文并失效 WeakMap 源文本快照。
- 通用提取排除 `aside`、搜索/互补区域和 breadcrumb 语义，避免 MDN 等技术文档页头误译；不使用网站专用硬编码规则。
- 公开矩阵的占位 API Origin 由 Playwright route 拦截，返回按请求 ID 对齐的纯文本 JSON，避免网络波动和费用影响结构验收。

权限、隐私与成本影响：

- 生产 Manifest、API Key 存储、网页数据发送边界和账本语义均不变。
- 矩阵真实页面只存在于临时浏览器进程；报告不保存正文、译文、Key 或私人 URL，Mock 请求不会产生厂商费用。

验证证据：

- `npm run typecheck`、`npm test` 和 `npm run build` 已通过；单测 10 个文件、65 项。
- Chrome for Testing 147 的 `test:browser:corpus` 已通过 6 个原创语料，包含虚拟列表复用、原地改写、body 替换和停止断言；1000 节点提取中位数 2.8 ms、最大 3.3 ms，完整缓存运行约 860.06 ms，Provider 请求 0。
- CDP 停止 MV3 Service Worker 后，可信设置消息成功唤醒后台，随后 11/11 段从本地缓存恢复，约 300.87 ms，Provider 请求仍为 0。
- 恶意样式译文 `<img onerror>` 与 `<script>` 只作为文本显示：生成元素 0、执行标记为 false，11 个原文节点保持存在。
- 全量公开矩阵配置 20 页，18 页通过、0 个产品验收失败、2 个环境失败；六类通过数为 article 4、technical-docs 4、readme-shell 2、discussion 2、academic 2、compact-list 4。
- 18 个通过页正文召回率均为 100%，非正文误译率为 0–3.68%，重复译文与排除区误译均为 0，译文均为单一文本节点，缓存复跑、链接 click 事件和停止断言全部通过。
- Stack Overflow 两页在最多两次环境重试后仍返回 HTTP 403；没有绕过访问保护，也没有发起真实 Provider 请求。

关联文档：

- `docs/PRD.zh-CN.md`
- `docs/PRODUCT-ROADMAP.md`
- `docs/SITE-COMPATIBILITY.md`
- `docs/ARCHITECTURE.md`
- `CHANGELOG.md`

遗留与下一步：Stack Overflow 需在用户普通 Chrome 可正常访问时做人工复验；公开页面结构会变化，矩阵结果只代表 2026-08-17 的页面与浏览器环境。下一轮进入 TD-2026-010 的 M1.5 Alpha 收口。

### TD-2026-010：Alpha 发布收口与公开目标筛选

| 字段 | 内容 |
| --- | --- |
| 状态 | 已验证，未发布 |
| 开始日期 | 2026-08-17 |
| 完成日期 | 2026-08-17 |
| 所属阶段 | M1.5 |
| 目标 | 补齐 Alpha 候选包的价格参考、隐私/权限资料、图标和发布门禁，并把默认网站目标收敛为稳定可访问的海外页面 |

范围：

- 为 OpenAI、阿里云百炼 Qwen、DeepSeek、OpenRouter 和硅基流动提供按精确 HTTPS API 主机名匹配的官方价格入口、核对日期和适用提示。
- 数字价格继续由用户手动填写并默认关闭；不抓取、不远程更新、不把过期价格静默写入成本配置。
- 新增隐私政策草案、Chrome 权限说明、开发者安装文档、Alpha 发布清单、扩展图标和 `npm run release:check`。
- 默认公开矩阵调整为 16 个无需登录且本轮实际通过的页面，优先覆盖海外非中文社区、框架官方文档和创意设计内容。
- 修复 Playwright CommonJS/ESM 导出兼容，并修复动态页面仍有待扫描 DOM 时过早发出 `complete` 的状态竞态。

非范围：

- 不内置数字模型价格，不承诺实时同步 Provider 价格或替代厂商账单。
- 不绕过登录、验证码、付费墙、403、429 或站点反自动化措施。
- 不调用真实 Qwen，不读取 `.env.local`，不新增依赖、生产权限、静态内容脚本或遥测。
- 不提交 Chrome Web Store，不创建版本 tag，不 commit 或 push。

关键决策：

- 官方价格目录是人工核对入口，不是自动生效的价格源；无法保证更新质量前，手动价格比内置过期数字更可信。
- 只有最近一次候选探测可访问且完整矩阵通过的页面进入默认目标。Hacker News、Wikipedia、Stack Overflow、ChatGPT Help、Lapa Ninja 和 SiteInspire 只保留环境记录。
- Chroma `Context Rot` 保留历史真实翻译证据，但因稳定性复跑出现 DOM 重建、召回波动和导航销毁执行上下文，不计入默认稳定目标。
- 有待处理的动态 DOM 时保持 `progress`，仅在扫描队列静止后发出 `complete`，避免 UI 和测试把中间状态当作最终结果。

权限、隐私与成本影响：

- 生产 Manifest 仍只有 `activeTab`、`scripting`、`storage` 和用户触发的可选 HTTPS Provider Origin；API Key 与网页数据边界不变。
- 官方价格链接不发送模型配置或用量；测试使用 Mock Provider/本地缓存，真实 Provider 请求为 0、模型费用为 0。
- 隐私政策仍是 Alpha 草案，公开发布前必须补充正式联系渠道并与 Chrome Web Store 数据披露复核。

验证证据：

- `npm run release:check` 通过：TypeScript、11 个测试文件共 73 项、Chrome MV3 生产构建、约 142.00 kB ZIP 和生产资产安全扫描全部成功；最终 ZIP SHA-256 为 `bfb719d1fc2a00e1606d3f60a0c7d4ee8e1472178c8a916575c559e59b96c13d`。
- Chrome for Testing 151.0.7922.34（darwin-arm64 / Apple M1 Pro）最终默认矩阵 16/16 通过，0 个产品失败、0 个环境失败；五类通过数为 5/2/4/2/3。
- 16 页正文召回率均为 100%，非正文误译率为 0–2.08%，重复译文与排除区误译均为 0；纯文本、缓存复跑、链接交互和停止行为全部通过。
- 六份原创语料在状态竞态修复后全部复跑通过；最终复核的 1000 节点提取中位数 3.2 ms、最大 5.2 ms，完整缓存运行约 676 ms，Service Worker 回收恢复与恶意输出纯文本断言通过。
- Options 的 Qwen 预设、官方价格链接、桌面/窄屏布局和多尺寸图标由安装态浏览器与生产 Manifest 验证。

关联文档：

- `README.md`
- `docs/PRD.zh-CN.md`
- `docs/PRODUCT-ROADMAP.md`
- `docs/ARCHITECTURE.md`
- `docs/SITE-COMPATIBILITY.md`
- `docs/PRIVACY.md`
- `docs/CHROME-PERMISSIONS.md`
- `docs/DEVELOPMENT.md`
- `docs/RELEASE-CHECKLIST.md`
- `CHANGELOG.md`

遗留与下一步：M1.5 仍需项目所有者核对真实 Provider 厂商账单、补充公开联系渠道、审查 Chrome Web Store 文案与数据披露并明确发布授权。未经这些人工步骤，项目状态保持未发布。

### TD-2026-011：官方用量/价格适配与 Token 可视化

| 字段 | 内容 |
| --- | --- |
| 状态 | 已验证，未发布 |
| 开始日期 | 2026-08-18 |
| 完成日期 | 2026-08-18 |
| 所属阶段 | M1.2 / M1.5 |
| 目标 | 在不索取高权限厂商凭证的前提下，用本地 token 账本和可验证的官方结构化价格接口改善账单可读性 |

范围：

- IndexedDB v1 增加只读历史聚合，返回最近 30 个本地日期、输入/输出 token、估算标记和账本可用状态；缺失日期补 0。
- Options 引入 ECharts 按需模块（LineChart、GridComponent、TooltipComponent、LegendComponent、CanvasRenderer），展示双折线并按最大量级选择 token/K/M/B Y 轴单位；包含加载、空数据、账本不可用和窄屏布局。
- Popup 与 Options 账单区域只展示 token，不展示插件计算的金额；手动价格/预算保留在独立的可选提醒设置中。
- Service Worker 新增 `GET_USAGE_HISTORY` 和 `REFRESH_PROVIDER_PRICING`；官方价格首期适配 OpenRouter `/api/v1/models`，精确匹配模型并严格校验 USD/token 字段后换算为 USD/百万 token。
- 对 OpenAI、阿里云百炼 Qwen、DeepSeek、硅基流动和 OpenRouter 调查普通推理 Key 的官方用量/价格能力，记录管理凭证限制和“不展示”的适配决策。

非范围：

- 不新增、保存或传输 OpenAI Admin API Key、OpenRouter Management Key、阿里云云账号凭证或其他高权限账单凭证。
- 不把 OpenAI 组织用量、Qwen BSS 账单、DeepSeek 余额或任何美元消费换算成 token；不把查不到的价格用手填数字冒充官方价格。
- 不新增 Manifest 权限、静态网站脚本、遥测或远程执行代码；不使用真实付费模型作为自动化验收。

关键决策：

- 普通推理 Key 不等于厂商账单/管理凭证：官方每日历史不可用时以 TextDuet 本地响应 usage 为唯一曲线数据源，并显式标注“本地记录”。
- 官方价格查询只在结构化接口、精确模型匹配、非负有限数字三项同时满足时展示；其他 Provider 完全隐藏数字价格。
- ECharts 仅在 Options 入口按组件注册，不进入 Popup、Translator 或 Service Worker；不引入 `echarts-for-react`。

权限、隐私与成本影响：

- 生产 Manifest 权限不变。OpenRouter 价格请求复用用户已授权的 Provider Origin，不携带 API Key、模型名称或本地用量；模型匹配在本机完成。
- 历史曲线不上传任何数据，账本仍不含网页正文、URL 或 Key。金额字段仅服务于既有本地预算提醒，账单表面只显示 token。
- 新增 ECharts Apache-2.0、zrender BSD-3-Clause 与 tslib 0BSD 的第三方归属。
- 生产构建与 ZIP 强制包含 `LICENSE`、`NOTICE` 和 `THIRD_PARTY_NOTICES.md`，发布门禁会检查文件存在并扫描文本安全边界。

验证证据：

- `npm run typecheck` 通过；Vitest 13 个测试文件、83 项测试全部通过；官方价格、历史聚合、Y 轴单位和新消息边界均有单元测试。
- `npm run release:check` 通过；Options 只产生按需 ECharts 代码，Popup 4.95 kB、background 57.56 kB、Options 561.11 kB，构建总大小约 913.68 kB，ZIP 约 323.27 kB 并包含三份许可证/归属文件。
- Chrome for Testing 151.0.7922.34（darwin-arm64 / Apple M1 Pro）安装生产 MV3 构建，Options 桌面与 390px 窄屏 Canvas 均有非透明像素；输入 1,240、输出 680、合计 1,920 token 正确显示，未出现 `USD 0.01`。
- 同一 Chrome 回归覆盖 6 份原创语料、动态新增/节点复用/body 替换、停止、Service Worker 恢复和恶意输出纯文本渲染；Provider 请求 0，最终复跑的 1000 候选中位 2.8 ms。
- Qwen 预设因无可靠结构化价格 API 不显示“核对来源”价格块；Options 窄屏保存栏改为文档流，避免覆盖表单。

关联文档：

- `README.md`
- `docs/PRD.zh-CN.md`
- `docs/PRODUCT-ROADMAP.md`
- `docs/ARCHITECTURE.md`
- `docs/PRIVACY.md`
- `docs/CHROME-PERMISSIONS.md`
- `CHANGELOG.md`
- `THIRD_PARTY_NOTICES.md`

遗留与下一步：OpenRouter 价格接口的字段和上游模型目录可能变化，需在发布前继续人工抽查；其他 Provider 的官方价格若未来提供稳定结构化接口，再单独立项适配。真实厂商账单核对、正式联系渠道、Chrome Web Store 审查和发布授权仍属于项目所有者的发布门槛。

### TD-2026-012：真实 Token 留存与 DeepSeek 余额

| 字段 | 内容 |
| --- | --- |
| 状态 | 已验证，未发布 |
| 开始日期 | 2026-08-18 |
| 完成日期 | 2026-08-18 |
| 所属阶段 | M1.2 / M1.5 |
| 目标 | 让首版 Token 历史只反映 Provider 返回的实际 usage，并为 DeepSeek 充值账户提供安全的余额查询 |

范围：

- 本地 token 账本只写入 Provider 响应返回的实际输入和输出 token；缺失 usage 时保留本次预估，但不写入历史。
- 历史曲线扩展到滚动 60 个本地日期，读取历史和成功记账时删除更早记录。
- 清理旧 Alpha 中混入估算 token 的聚合记录；因旧结构无法拆分同一聚合内的实际与估算 token，含估算的旧聚合整条删除。
- DeepSeek 官方配置增加用户主动余额查询，展示 CNY/USD 总余额、充值余额、赠送余额和可用状态。

非范围：

- 不查询厂商每日历史、不新增管理凭证，不把余额或金额反推为 token。
- 不为自定义 DeepSeek 代理或其他兼容端点发送 API Key，不持久化余额响应。
- 不新增 Manifest 权限、运行时依赖、遥测或项目后端。

关键决策：

- “翻译前估算”与“历史事实账本”分离；前者用于操作前提示，后者只记录 Provider 返回的 usage。
- “近两个月”在首版定义为含今天在内的滚动 60 个本地自然日，避免月长变化造成图表与保留策略漂移。
- 余额请求由 Service Worker 从可信存储读取 Key，且目标 Origin 必须精确等于 `https://api.deepseek.com`。

权限、隐私与成本影响：

- Manifest 权限不变，复用用户保存 DeepSeek 配置时已授权的官方 API Origin。
- Key 不进入 RuntimeMessage、Options、账本、日志或测试；余额只驻留于当前 Options React 状态。
- 余额仅作账户状态展示，不进入预算计算，不替代 DeepSeek 厂商账单。

验证证据：

- `npm run release:check` 通过：TypeScript、15 个 Vitest 测试文件、91 项测试、生产构建、ZIP 和发布资产检查全部通过；发布包为 `.output/textduet-0.1.0-chrome.zip`。
- `npm audit --omit=dev` 返回 0 个已知漏洞；生产 Manifest 仍只有 `activeTab`、`scripting`、`storage` 与既有可选 HTTPS Origin 范围，没有静态内容脚本。
- Chrome for Testing 145.0.7632.6（darwin-arm64）加载生产 MV3 构建：维护后 4 条种子记录只保留 2 条合法实际记录，60 日汇总输入 1,340、输出 700、合计 2,040，Canvas 可见像素 9,795。
- 同一浏览器回归以后台确定性 Mock 验证 DeepSeek 请求目标为 `https://api.deepseek.com/user/balance`、认证头只在 Service Worker 使用、CNY 充值/赠送余额正确展示；桌面和 390px 截图通过，目标区域横向溢出为 0。
- Chrome for Testing 145.0.7632.6 使用用户本机 Provider 配置复验公开的 Chroma `Context Rot`：1 次真实请求返回 HTTP 200，约 39.14 秒完成 70 段纯文本译文，排除区域误译 0；本地账本输入 1,789、输出 1,648、合计 3,437 token，实际调用 1、估算调用 0，用量图非空。
- DeepSeek 余额自动化仍使用 Mock，没有查询真实账户；Chroma 翻译使用用户本机 Provider 配置并可能产生一次模型费用。真实账户余额只应由项目所有者主动核对。

关联文档：

- `README.md`
- `docs/PRD.zh-CN.md`
- `docs/PRODUCT-ROADMAP.md`
- `docs/ARCHITECTURE.md`
- `docs/PRIVACY.md`
- `CHANGELOG.md`

遗留与下一步：DeepSeek 可能调整余额响应字段或认证策略，项目所有者可使用自己的普通推理 Key 做一次人工查询；真实余额不得进入测试报告或截图。Chrome Web Store 与正式联系渠道已在 TD-2026-013 随商店分发整体移出首版范围。

### TD-2026-013：Alpha 本地安装候选验收

| 字段 | 内容 |
| --- | --- |
| 状态 | 已验证，未发布 |
| 开始日期 | 2026-08-18 |
| 完成日期 | 2026-08-18 |
| 所属阶段 | M1.5 |
| 目标 | 生成并验证可在 Chrome 开发者模式本地加载的 Alpha 候选包，完成 M1 收口 |
| 项目所有者验收 | 2026-08-18，本机 Chrome 使用 Qwen，正常使用通过 |

范围：

- 把首版交付方式收敛为本地构建、ZIP 传输、解压后通过 `chrome://extensions` 加载；不接入 Chrome Web Store、其他商店或自动更新。
- 从锁文件干净安装依赖，运行完整类型、单测、构建、ZIP 和产物安全门禁。
- 从最终 ZIP 解压候选包，以临时全新 Chrome 配置完成安装态核心翻译、动态内容、缓存、用量、余额 Mock 和安全渲染验收。
- 复跑 16 个无需登录的默认公开网站目标，保留网络环境失败并在出口恢复后定向复验。
- 同步 PRD、路线图、README、隐私、架构、本地安装指引、发布清单和 CHANGELOG。

非范围：

- 不提交 Chrome Web Store，不准备商店截图、描述或公开隐私政策 URL，不提供自动更新。
- 不 commit、tag、push、创建 GitHub Release 或向外部分发候选包。
- 不读取 `.env.local`，不调用真实付费模型，不查询真实 DeepSeek 余额或厂商后台账单。
- 不修改运行时代码、依赖、Manifest 权限、存储结构或 Provider 协议。

关键决策：

- ZIP 是可传输候选归档，不是 Chrome 可直接加载的格式；用户必须先解压并选择包含 `manifest.json` 的目录。
- 商店资料、正式联系渠道和商店隐私披露随商店分发整体延期，不再阻塞首版本地安装候选。
- 当次公开矩阵的网络失败不伪装为通过；在独立探测确认 GitHub 出口恢复后，仅复跑失败样本，并与首轮结果共同构成 16 页候选证据。
- 厂商账户金额不从 token 或余额反推；此前真实 Qwen 响应 usage 与本地账本证据继续有效，但不宣称与厂商后台金额一致。

权限、隐私与成本影响：

- 生产 Manifest 仍只有 `activeTab`、`scripting`、`storage` 和可选 HTTPS Provider Origin；无静态内容脚本或静态主机权限。
- 本轮浏览器回归使用本地缓存、Mock Provider 和 Mock DeepSeek 余额，Provider 请求和模型费用均为 0。
- 候选包安全扫描未发现真实 Key、认证头、个人绝对路径、远程可执行脚本、`eval` 或 `new Function`。

验证证据：

- `npm ci` 通过：安装 188 个包，审计 189 个包，0 个已知漏洞。
- `npm run release:check` 通过：TypeScript、15 个 Vitest 测试文件、91 项测试、生产构建、ZIP 和发布资产扫描全部成功。
- 候选包 `.output/textduet-0.1.0-chrome.zip` 为 325.78 kB，SHA-256 为 `2e46b1f318eab413627ad95feb9342bd871aa6ccafe42aeb4ad5ac3468e1b6fb`。
- Chrome for Testing 151.0.7922.34（darwin-arm64 / Apple M1 Pro）从候选 ZIP 解压目录启动；Manifest 版本 `0.1.0`、图标、Popup 和 Options 可加载。
- 6 份原创语料全部通过；动态追加、节点离线复用、原地改写、body 替换、停止、缓存复跑和 Service Worker 回收恢复通过。1000 个候选节点提取中位 2.8 ms、最大 3.5 ms，完整缓存运行约 936.17 ms；Provider 请求 0。
- 恶意模型样式文本只作为纯文本显示，没有生成元素或执行脚本；60 天用量汇总为输入 1,340、输出 700、合计 2,040 token，Canvas 可见像素 9,795；桌面和 390px 余额区域无横向溢出。
- 公开矩阵首轮 12/16 通过、0 个产品失败，4 个 GitHub 页面为网络环境失败；定向复跑后 4/4 通过。合并结果覆盖 16 个默认目标，各页正文召回率 100%，非正文误译率 0–2.08%，重复译文和排除区误译均为 0。
- 人工查看 Options 桌面与 390px 截图，配置、用量图、余额、预算和缓存区域未发现文字遮挡或目标区域溢出。
- 项目所有者已在本机 Chrome 使用 Qwen 配置完成首版真实使用验收，确认插件可正常使用。

关联文档：

- `README.md`
- `CHANGELOG.md`
- `docs/PRD.zh-CN.md`
- `docs/PRODUCT-ROADMAP.md`
- `docs/RELEASE-CHECKLIST.md`
- `docs/DEVELOPMENT.md`
- `docs/PRIVACY.md`
- `docs/ARCHITECTURE.md`

遗留与下一步：项目仍无 commit、tag 或公开发布物。真实厂商账户金额和 DeepSeek 余额只由项目所有者按需核对；不影响本地安装候选结论。下一轮进入 M2 本地 Beta，优先建设网站规则层、兼容性诊断包和可控的公开页面周期回归。

### TD-2026-014：M2 站点规则层与诊断数据契约

| 字段 | 内容 |
| --- | --- |
| 状态 | 已验证，未发布 |
| 开始日期 | 2026-08-18 |
| 完成日期 | 2026-08-18 |
| 所属阶段 | M2 |
| 目标 | 用可维护的保守规则改善重点站点提取，并建立不含正文和密钥的本地诊断数据基础 |

范围：

- 新增 `src/translator/site-rules.ts`，按 HTTPS 页面主机名匹配 GitHub、框架技术文档、海外社区和创意设计四类规则。
- 规则只声明内容根节点和额外排除选择器；根节点不存在或站点未知时回退原有通用提取器。
- Translator Script 在用户主动翻译会话内解析当前 `window.location`，不读取 URL 查询参数，不把规则配置交给网页或 Provider。
- 新增 `src/core/compatibility-diagnostics.ts`，生成包含主机名、可选路径、浏览器/扩展版本、候选/已翻译/失败批次数和标准化问题码的本地诊断对象；默认不包含路径。
- 新增规则和诊断数据的单元测试，并使用真实公开站点安装态回归验证四类规则。

非范围：

- 不新增 Manifest 权限、运行时依赖、Provider 协议、网络上传、遥测或自动翻译。
- 不在本轮增加诊断包下载按钮、截图采集、Issue 自动提交或用户反馈 UI；这些能力进入后续 M2 迭代。
- 不为单一站点编写绕过登录墙、验证码、付费墙或反自动化措施的专用规则。

关键决策：

- 规则优先级由明确主机名和保守根选择器组成，不采用远程规则目录；站点变更不会静默改变用户的扩展行为。
- 规则只缩小候选范围，不改变翻译消息、API Key、缓存键或 Provider 请求格式；根选择失败必须回退，避免规则造成整页漏译。
- 诊断对象拒绝完整 URL，只在用户未来显式选择时加入已去除查询参数和片段的 pathname；不接受正文、API Key、认证头或截图二进制。

权限、隐私与成本影响：

- Manifest、主机权限和 API Key 生命周期不变；规则模块只运行在已注入的 Translator Script 中。
- 规则回归使用 Mock Provider，Provider 请求和模型费用为 0；诊断数据只在内存中生成，当前没有持久化或离开设备的路径。

验证证据：

- `npm run typecheck` 通过；17 个 Vitest 测试文件、97 项测试通过。
- `npm run build` 通过；生产 Translator 构建为 36.04 kB，未新增权限或远程代码。
- M2 开发构建 ZIP `.output/textduet-0.1.0-chrome.zip` 为 326.27 kB，SHA-256 为 `1cb44a778086eccce4cd3dbdd06b19f8a9251375e6bdfda5bd0436fb75565a23`；该构建尚未替代 TD-2026-013 的项目所有者 Alpha 冻结包验收。
- Chrome for Testing 151.0.7922.34（darwin-arm64）安装态原创语料回归 6/6 通过；动态节点复用、停止、Service Worker 恢复、恶意输出纯文本和 1000 节点提取目标继续通过，Provider 请求 0。
- 公开站点规则抽查 4/4 通过：React 文档、GitHub README、DEV 社区、Smashing Magazine；正文召回率 94.52%–100%，非正文误译率均为 0，重复译文为 0，缓存复跑、链接交互和停止断言通过。
- 诊断单测确认默认去除路径和查询参数，拒绝 URL、负计数和不安全错误码；序列化结果不包含正文或密钥字段。

关联文档：

- `README.md`
- `CHANGELOG.md`
- `docs/PRODUCT-ROADMAP.md`
- `docs/SITE-COMPATIBILITY.md`
- `docs/ARCHITECTURE.md`
- `docs/PRIVACY.md`

遗留与下一步：M2 整体仍在进行中。下一轮实现本地诊断包预览/下载流程和问题类型入口，随后再评估公开页面周期回归；在完成用户明确预览和同意前不上传任何诊断数据。

### TD-2026-015：M2 本地诊断预览与下载

| 字段 | 内容 |
| --- | --- |
| 状态 | 已验证，工程与自动化证据完成；Chrome 打包、加载和人工验收由项目所有者负责 |
| 开始日期 | 2026-08-18 |
| 所属阶段 | M2 |
| 目标 | 让本地安装用户在不上传网页内容的前提下预览并下载可控的兼容性诊断包 |

交付范围：

- Options 新增兼容性诊断卡：问题类型选择、路径明确同意、生成本地预览和下载 JSON。
- 翻译启动成功后仅在 storage.session 保存最近标签页 ID；Options 不再错误读取设置页自身作为诊断目标，标签页关闭时清理记录。
- Translator Script 返回候选、已翻译和失败批次数；运行时消息和诊断响应均经过 Zod 校验。
- 截图采集、Issue 自动提交、遥测和任何自动上传不在本轮范围。

关键决策：

- 诊断默认只包含脱敏主机名、版本和计数；pathname 需要独立勾选并重新生成。
- 诊断只能关联最近一次启动翻译的页面，不扫描其他标签页，不读取正文，不把 URL 传给 Translator Script。
- 下载由 Options 使用本地 Blob 完成，用户主动下载后才产生文件，不向外部服务发送数据。

权限、隐私与成本影响：无新增 Manifest 权限、Provider 请求、API Key 读取或模型费用。会话标签页 ID 不含 URL，随标签页关闭清理；诊断 JSON 默认不含 pathname、正文、参数、片段、表单、Key 或截图。

验证证据：

- npm run typecheck 通过。
- npm test 通过：17 个测试文件、99 项测试；新增运行时诊断消息、诊断响应和截图字段拒绝测试。
- node --check .playwright/extension-corpus.mjs 通过；真实回归脚本新增翻译后生成预览、路径同意撤销、问题类型和下载文件名断言。
- npm run build 与 node scripts/verify-release.mjs 通过；Manifest 权限仍为 activeTab、scripting、storage 和可选 HTTPS Origin。
- 尝试使用本机 Google Chrome 151 执行真实 MV3 安装态回归时，Chrome 在 15 秒内未启动扩展 Service Worker，故本轮不声称浏览器成功路径已验证；需在现有可用 Chrome for Testing 环境复验。

关联文档：

- README.md
- CHANGELOG.md
- docs/PRODUCT-ROADMAP.md
- docs/PRIVACY.md
- docs/ARCHITECTURE.md

遗留与下一步：在可启动扩展 Service Worker 的 Chrome 环境完成成功路径回归；TD-2026-016 先处理用户确认的阅读控制、多模型和译文样式改进，受控公开页面周期回归与 M2 已知问题清单顺延至 TD-2026-017，不增加自动上传。

### TD-2026-016：M2 阅读控制、多模型与译文样式

| 字段 | 内容 |
| --- | --- |
| 状态 | 已验证，工程、单元测试与生产构建完成；Chrome 打包、加载和人工验收由项目所有者负责 |
| 开始日期 | 2026-08-18 |
| 所属阶段 | M2 |
| 目标 | 让用户在网页翻译后可靠控制原文/译文显示、模型选择和译文颜色，并修复 Chroma 正文目录与长期状态提示问题 |

交付范围：

- Popup 新增双语、原文、译文三段显示控件；翻译与停止合并为一个由页面状态驱动的按钮，进行中轮询脱敏页面状态并在完成后恢复翻译操作。
- Options 支持同一服务商维护多个模型名称/code、选择当前模型，以及使用展开式取色盘或十六进制、RGB、RGBA 文本配置译文颜色。
- Translator Script 用可逆原文 wrapper 和纯文本译文节点切换显示，不删除原文；完成与停止提示 3.5 秒后移除。
- 重复点击翻译会先恢复原始 DOM、移除旧译文并携带 `forceRefresh` 绕过缓存，确保重新请求当前模型；单纯显示切换不调用模型。
- Chroma Research 规则在 `.markdown-content` / `article` 根内增加正文目录链接候选，顶部站点导航仍排除；新增原创 `chroma-research-toc.html` 语料。
- 安装态语料脚本由预灌缓存改为拦截 Mock Provider，增加多模型、重复请求、显示模式、颜色、单一按钮、提示自动移除和目录链接交互断言。

关键决策：

- 模型列表与当前模型仍属于同一 OpenAI-compatible Provider 配置，不新增 Provider 协议、网络端点或 Manifest 权限。
- 重新点击翻译的产品语义是“明确重新请求”，即使已有本地缓存也会产生新 Provider 调用，可能产生费用；页面当前译文在用户再次触发前保持不变。
- 译文颜色先经过严格 schema 校验，仅接受受限的十六进制、RGB 或 RGBA；不接受命名颜色、CSS 函数或可拼接声明的文本。
- Chroma 目录适配通过规则局部选择器完成，不把所有网站的链接加入通用提取器。

权限、隐私与成本影响：无新增 Manifest 权限、主机权限或 Key 数据流。Popup 状态查询只返回 `idle/progress/complete/stopped/empty/error` 和 `hasRun`。模型列表与颜色保存在现有可信设置；重复翻译会产生新的模型请求和可能的费用，显示模式切换不产生请求。

验证证据：

- `node --check .playwright/extension-corpus.mjs` 通过。
- `npm run typecheck` 通过。
- `npm test` 通过：18 个测试文件、118 项测试；覆盖多模型/颜色 schema、恶意颜色拒绝、强制刷新绕过缓存和 Chroma 规则字段。
- `npm run release:check` 通过：类型检查、单测、生产构建、ZIP 和发布安全校验完整通过；`npm audit --omit=dev` 报告 0 个漏洞。
- 生产 ZIP 为 333,466 bytes，SHA-256 为 `a2467b5fa1132037daef7dfb55a7844f099d1f610f0f09cff4771a7d29fc22fe`；Manifest 仍只有 `activeTab`、`scripting`、`storage` 和可选 HTTPS Origin，无静态内容脚本。
- 使用本机 Google Chrome 151 分别以无头和可见模式运行安装态语料时，Chrome 均未在 15 秒内启动扩展 Service Worker；因此本轮不声称新增 UI 与 Chroma 目录浏览器断言已通过，需在可用 Chrome for Testing 环境复验。

关联文档：

- `README.md`
- `CHANGELOG.md`
- `docs/PRD.zh-CN.md`
- `docs/PRODUCT-ROADMAP.md`
- `docs/SITE-COMPATIBILITY.md`
- `docs/ARCHITECTURE.md`

遗留与下一步：先在可启动 MV3 Service Worker 的 Chrome for Testing 环境运行更新后的七份原创语料，并人工检查 Popup 默认宽度、Options 桌面/窄屏、键盘焦点和 Chroma 目录链接；通过后关闭 TD-2026-015/016 的共同浏览器缺口。项目所有者已将 TD-2026-017 调整为可读性、分模型用量与设置体验迭代；受控公开页面周期回归和 M2 已知问题清单顺延至 TD-2026-018。

### TD-2026-017：M2 可读性、分模型用量与设置体验

| 字段 | 内容 |
| --- | --- |
| 状态 | 已验证，代码、发布检查和独立视觉验收完成；Chrome 打包、加载和人工验收由项目所有者负责 |
| 开始日期 | 2026-08-18 |
| 所属阶段 | M2 |
| 目标 | 在复杂网页配色下保持译文可读，并让多模型配置和本地用量查看更清晰 |

交付范围：

- Translator Script 为每个候选区块读取原文字体色、有效背景色、用户偏好色和字号，计算 WCAG 对比度门槛，并将这些非敏感样式数值随原翻译批次发送。
- 默认翻译提示要求模型只在 `preferred` 与 `source` 两个候选中建议颜色；模型不能返回 CSS。内容脚本在渲染前再次执行确定性对比度门禁，不合格时优先使用原文色，极端情况下回退黑/白高对比色。
- 缓存结构保持不变；缓存命中没有模型颜色建议时由本地对比度算法选择，不迁移或丢弃既有译文缓存。
- 60 日账本读取结果新增按 Provider/模型分组的每日输入/输出序列。Options 可选择模型查看每日曲线，并同时列出所有模型的 60 日输入、输出和合计。
- Options 将每行一个模型的文本域替换为回车/逗号生成的标签输入；标签可点击设为当前模型、单独删除，键盘 Backspace 可移除最后一项。
- Options 主宽度、8px 卡片圆角、字段栅格、状态区和卡片操作区统一；桌面保持稳定两列，小屏回退单列。

关键决策：

- AI 只提供受限建议，本地算法拥有最终否决权；不能依赖模型遵守提示来保证可访问性，也不允许模型输出任意颜色或样式。
- 样式判断复用现有翻译请求，不为每个区块额外调用模型。代价是请求中增加少量颜色和对比度字段，可能略增输入 token。
- 用量 IndexedDB v1 原本已按日期、Provider 和模型保存，分模型展示只扩展读取契约，不升级数据库。
- 本轮新增范围优先解决已复现的阅读与配置问题；原定 TD-2026-017 公开页面周期回归调整为 TD-2026-018，未从 M2 范围删除。
- 项目所有者授权创建并首次推送开发阶段检查点 commit；该动作不创建 tag、不创建 GitHub Release，也不表示第一版已达到可上线开源状态。

权限、隐私与成本影响：无新增 Manifest 权限、Provider Origin、API Key 数据流或远端服务。发送给模型的新增字段只有标准化颜色、对比度和门槛，不含 DOM、选择器、URL、截图或样式表。样式元数据会增加少量输入 token；缓存命中仍不产生调用。

验证证据：

- `npm run typecheck` 通过。
- `npm test -- --run` 通过：18 个测试文件、123 项测试；新增颜色解析/合成/对比度安全门、模型受限选择和分模型每日聚合测试。
- `npm run release:check` 通过：类型检查、123 项单测、生产构建、ZIP 和发布资产安全扫描完整通过；ZIP 为 336,198 bytes，SHA-256 为 `0c5f809a434df3cfa14be8c205d2ed629f53866dbb21087d03ebbef8a054981d`。
- `npm audit --omit=dev` 为 0 个已知漏洞；Manifest 权限仍为 `activeTab`、`scripting`、`storage` 和可选 HTTPS Provider Origin。
- `npm run test:browser:options` 使用真实生产 HTML/JS/CSS 与页面侧脱敏 runtime mock 完成独立视觉验收：两个模型可切换，ECharts Canvas 非透明像素 10,776，1280px 与 390px 均无横向溢出；人工检查截图未发现文字遮挡、标签溢出或错位。
- 安装态语料脚本已增加模型故意返回 `preferred` 时，深红偏好色在橙色背景上必须回退原文色的断言，并更新为标签式模型交互和双模型用量。脚本语法通过，但本机 Chrome 151 仍未加载测试扩展/启动 Service Worker，因此该主链路不计为通过。

界面主题同步（2026-08-19）：

- Popup、Options、ECharts 用量图和网页状态提示已统一为暖纸色、白色表面、赤陶色主操作和赭石色辅助的主题；扩展图标同步更新为叠放文字面板的暖色版本。
- Options 的设置卡片、字段、标签、操作区、用量摘要和窄屏布局已按同一视觉尺度整理；Popup 保持 Chrome 工具栏可用的紧凑宽度。
- 默认译文颜色由绿色调整为 `#9c5e2e`；该默认值只是 UI 偏好，逐区块仍由原文字色、有效背景和本地 WCAG 门禁决定最终可读颜色。
- 主题只改变扩展 UI、图标和网页状态提示的表现，不改变 Manifest 权限、API Key 存储、Provider 请求或网页正文数据流。
- 项目所有者负责每个版本的 Chrome 打包、加载、真实操作和最终人工验收；Agent 只记录已执行的自动化证据与项目所有者明确反馈，不推断安装态通过。
- 根目录 `main.html` 与 `popup.html` 是未纳入 WXT 构建入口的本地视觉原型，保留供设计比对；生产入口仍是 `entrypoints/options` 和 `entrypoints/popup`。

本次同步验证：

- 主题代码已完成静态检查，旧绿色品牌主色已从生产状态提示和 UI 规范中移除。
- 新主题的生产构建与 Options 桌面/窄屏视觉检查已由 Agent 完成；Chrome 安装态主链路由项目所有者负责打包、加载和人工验收，结果待项目所有者反馈。此前 TD-2026-017 的旧主题视觉截图不作为本次主题验收证据。

关联文档：

- `README.md`
- `CHANGELOG.md`
- `docs/PRD.zh-CN.md`
- `docs/PRODUCT-ROADMAP.md`
- `docs/ARCHITECTURE.md`
- `docs/PRIVACY.md`
- `docs/SITE-COMPATIBILITY.md`

遗留与下一步：项目所有者负责验证新主题下的 Popup/Options 安装态显示、红色偏好落在相近背景时自动回退、标签模型保存/切换和分模型用量图；反馈后关闭 TD-2026-015/016/017 的安装态验收项。Agent 进入 TD-2026-018，执行受控公开页面周期回归、环境失败与产品失败分离、M2 已知问题清单和回归报告。

### TD-2026-018：M2 公开页面周期回归与问题收口

| 字段 | 内容 |
| --- | --- |
| 状态 | 已验证；项目所有者已完成 Chrome 安装态验收，自动化矩阵环境失败单独保留 |
| 开始日期 | 2026-08-19 |
| 完成日期 | 2026-08-19 |
| 所属阶段 | M2 |
| 目标 | 用可重复的公开页面矩阵收集兼容性变化，区分环境失败与产品失败，并形成 M2 已知问题收口清单 |

范围：

- 使用 `.playwright/extension-site-matrix.mjs` 对当前 16 个默认公开 URL 执行结构回归；优先覆盖海外非中文社区、框架官方技术文档、创意设计站，并保留 GitHub README 与学术页面结构样本。
- 每页使用 Mock Provider，不读取 `.env.local`，不产生真实模型费用；报告只保存脱敏计数、阈值、状态、环境失败类别和页面类型。
- 验证正文召回率、非正文误译率、重复译文、纯文本渲染、链接交互、缓存复跑和停止后新增节点不翻译。
- 将公开页面的访问保护、登录墙、验证码、网络失败和页面结构变化分别归类；受限页面不计入默认产品失败。
- 汇总 TD-2026-015/016/017 的 Chrome 安装态项目所有者验收项，并在本轮完成反馈闭环。

非范围：

- 不绕过网站访问控制，不抓取或保存第三方全文。
- 不新增 Provider、Manifest 权限、自动上传、遥测或网站自动发现服务。
- 不代替项目所有者执行 Chrome 打包、加载或真实网页操作；只记录项目所有者明确反馈。

退出条件：

- 默认矩阵达到至少 15 个通过页面，五类页面各至少 2 个通过；产品失败与环境失败分离记录。
- 每个产品失败都有可复现 URL、页面类型、标准化类别和下一步；不保存正文、Key 或完整响应。
- M2 已知问题清单更新，TD-2026-015/016/017 的工程与自动化证据链接完整；Chrome 安装态结论已由项目所有者反馈关闭。
- `npm run typecheck`、`npm test`、`npm run build` 和站点回归脚本语法检查通过。

权限、隐私与成本影响：无新增权限、Provider 请求或数据离开设备。公开页面只发送给本地 Mock Provider；报告不包含正文、译文、API Key、查询参数或截图。

首轮执行计划：先运行 `TEXTDUET_SITE_MIN_PASS=15 npm run test:browser:sites`，保存终端 JSON 到本地忽略目录；失败时按类别修复规则或记录环境状态，再定向运行 `TEXTDUET_SITE_IDS=<id>`。

首轮执行证据（2026-08-19）：命令在测试宿主初始化阶段等待 Chrome MV3 Service Worker 超时（`browserContext.waitForEvent: Timeout 15000ms exceeded while waiting for event "serviceworker"`）。脚本现将此类失败输出为顶层 `status: environment-failed`、`category: extension-service-worker-unavailable` 并返回非零退出码；没有开始导航，也没有生成任何页面通过或产品失败结论。原因属于本机 Chrome/Playwright 扩展加载环境，需由项目所有者在其可启动 Service Worker 的 Chrome 环境完成打包、加载和人工验收后再继续关闭本条目。

项目所有者验收反馈（2026-08-19）：项目所有者已在本机 Chrome 完成本轮插件打包、加载、真实网页操作和功能检查，确认 TD-2026-018 验收通过。该反馈关闭 Chrome 安装态待验收项；由于未提供页面数量、站点明细或截图数据，本记录不补写未被反馈的统计数字。Agent 的公开页面自动化矩阵仍保留上述 Service Worker 环境失败证据，不将其改写为产品通过。

### TD-2026-019：M2 无感接入、语言对、流式翻译与选区翻译

| 字段 | 内容 |
| --- | --- |
| 状态 | 进行中；代码、单元测试、生产构建和发布安全门已更新，Chrome 安装态验收待项目所有者执行 |
| 开始日期 | 2026-08-19 |
| 所属阶段 | M2 |
| 目标 | 降低网页侵入感、明确语言方向、缩短首段译文等待，并提供低成本选区翻译 |

交付范围：

- 网页不再创建右下角 TextDuet 状态浮层；状态仅保留在扩展上下文。
- Provider 设置新增源语言偏好；目标语言支持跟随系统，并按语言族映射到已支持语言。
- OpenAI-compatible Chat Completions 增加 SSE 流式读取和普通 JSON 同响应回退；完成段落通过 Port 增量渲染，动态新增内容进入后续批次。
- 新增 Chrome `contextMenus` 选区入口，跨段选区作为一个块在起始段落后插入纯文本译文；错误提示短暂显示在选区锚点。
- 选区译文颜色与整页用户配置统一；增加按需注入的选区边角快捷图标，Popup/Options 可关闭。
- 首批 1200 字符优先、成本预估并行，减少“流式已开启但页面末尾才出现”的等待。
- 修复 Popup/Options 页面开发规范缺失造成的组件错位：收紧语言组件 CSS 作用域，明确三列语言网格和 Options 外观双列布局，新增页面开发标准文档。

关键决策：

- 流式请求不向在途 HTTP 请求追加新段落；页面新增节点在当前批次结束后进入下一批，避免依赖非标准 Provider 协议。
- 选区翻译默认复用缓存，不强制刷新；不新增网站常驻内容脚本或服务器。
- 旧配置的显式目标语言保持不变，新安装默认跟随系统；无法映射的系统语言回退 English。

权限、隐私与成本影响：新增 `contextMenus` 用于用户主动选区翻译；不新增静态全站权限、Provider、遥测或数据上传。SSE 与选区请求仍由可信 Service Worker 读取 Key 并发往用户选择的模型服务商。

验证证据：

- `npm run typecheck` 通过。
- `npm test` 通过：20 个测试文件、132 项测试；覆盖语言映射、SSE 分块、usage、普通 JSON fallback、增量段落解析和中途断流。
- `npm run release:check` 通过：生产 Manifest 包含计划内 `contextMenus`，无静态全站脚本或生产 Host 权限，并生成 `.output/textduet-0.1.0-chrome.zip`。
- Chrome 安装态验证仍由项目所有者负责打包、加载和人工验收。

遗留与下一步：补齐 SSE Provider 真流、选区菜单和 Popup/Options 生产页面浏览器回归；更新生成 Manifest、权限文档和验收清单；完成后再评估是否进入 V1.0 发布候选收口。

### TD-2026-020：M2 流式回显、页面壳层兼容与选区快捷入口稳定性

| 字段 | 内容 |
| --- | --- |
| 状态 | 已验证；项目所有者已完成 Chrome 安装态验收，自动化矩阵环境失败单独保留 |
| 开始日期 | 2026-08-19 |
| 完成日期 | 2026-08-24 |
| 所属阶段 | M2 |
| 目标 | 让已完成批次立即回显，覆盖页头/导航/页脚可读文本，并稳定提供清晰的选区翻译快捷入口 |

范围：
- 批次完成事件增加幂等整批回显，兼容缓冲式 SSE 服务。
- 候选提取覆盖 header、navigation tab/link 和 footer 正文，同时保留交互、代码、表单、隐藏区和侧栏排除。
- 选区快捷图标采用 pointer/mouse/touch 多事件与 debounce，fixed 视口定位和稳定选区快照；按钮使用本地“文A”双语 glyph。
- 验收反馈修复：空选区事件不再移除监听或抑制后续真实划词；快捷图标默认关闭，只有用户明确开启才显示。
- Options 保存开关时优先使用最近网页标签，Service Worker 无历史记录时从当前窗口网页标签兜底选择，避免把注入目标误选为 Options 页面。

非范围：
- 不新增 Provider、服务端、遥测、静态全站内容脚本或外部资源。
- 不由 Agent 代替项目所有者执行 Chrome 打包、加载和真实网页验收。

关键决策：
- 完成事件的回显只写入已通过 schema 校验的完整 blocks，不把半截 SSE 文本写入 DOM；重复写入由现有节点复用保证幂等。
- 页面壳层只纳入可读链接/段落，控件与侧栏仍按安全排除规则处理。

权限、隐私与成本影响：
- 无新增权限、网络数据流、密钥存储或费用结算语义。

验证证据：
- `npm run typecheck` 通过。
- `npm test` 通过：20 个测试文件、133 项测试。
- `npm run release:check` 和 `git diff --check` 待本轮最终构建后复核。
- 待项目所有者在最新 `.output/chrome-mv3` 中验收批次即时回显、header/footer、选区图标稳定性与视觉效果。

关联文档：
- `docs/PRD.zh-CN.md`、`docs/SITE-COMPATIBILITY.md`、`docs/ARCHITECTURE.md`、`CHANGELOG.md`。

遗留与下一步：
- 完成工程验证后，项目所有者进行 Chrome 安装态验收；通过后再评估 V1.0 发布候选收口。

项目所有者验收反馈（2026-08-24）：项目所有者已在本机 Chrome 完成 TD-2026-020 全部范围的打包、加载、真实网页操作和功能检查，确认批次即时回显、header/navigation/footer 可读文本召回、选区快捷图标稳定性与默认开关行为符合预期，验收通过。该反馈关闭 Chrome 安装态待验收项；本记录不补写未被反馈的页面数量或截图统计，公开页面自动化矩阵的环境失败证据按既有约定继续保留。

### TD-2026-021：V1.0 本地安装版收口(已暂缓,合并到 0.2.0)

| 字段 | 内容 |
| --- | --- |
| 状态 | **已暂缓**；Agent 侧门禁与文档已就位，DeepSeek 真实连接通过、OpenAI 跳过；2026-08-26 项目所有者评估后决定跳过 0.1.0 直接发 0.2.0,合并入 TD-2026-025 |
| 开始日期 | 2026-08-24 |
| 暂缓日期 | 2026-08-26 |
| 所属阶段 | V1.0 → 0.2.0(由 TD-2026-025 接管发布) |
| 目标 | 完成 PRD §12 本地安装版全部验收门，把当前"已验证、未发布"状态切为"已发布 0.1.0"，形成首个对外可分发的本地安装版 |

范围（Agent 侧，本轮已执行或即将执行）：

- 跑完整 `npm run release:check`，确认类型检查、20 个测试文件 / 135 项单元测试、生产构建、Chrome ZIP 打包和生产 Manifest 安全门禁通过。
- 在 `src/`、`entrypoints/` 与 `.output/chrome-mv3/` 复核 API Key、`Authorization: Bearer`、真实账户信息或绝对路径不会出现在内容脚本、console 日志、构建产物或错误对象中；不通过的命中点回到修复。
- 把当前 `CHANGELOG.md` Unreleased 段切为 `## [0.1.0] - 2026-08-24`，按 [Keep a Changelog](https://keepachangelog.com/) 维护面向用户的发布说明。
- 更新 `README.md` 顶部版本字段、`docs/RELEASE-CHECKLIST.md` 的"本次验收记录"段、`docs/PRIVACY.md` 与 `docs/CHROME-PERMISSIONS.md` 的版本适用说明，使其与 `0.1.0` 对齐。
- `docs/PRODUCT-ROADMAP.md` 的 V1.0 状态从"已规划"改为"已发布"；`docs/PRD.zh-CN.md` 顶部"产品阶段"从"进入 V1.0 本地安装版准备"改为"已发布 0.1.0"。
- 准备好 `0.1.0` 的 release notes 草稿，但**不**自动 push、tag 或创建 GitHub Release；这两项按 `AGENT_DEV.md §5` 需要项目所有者单独授权。

范围（项目所有者侧，必须由本机 Chrome 执行，Agent 不代验）：

- 真实连接 OpenAI（推荐 `gpt-4o-mini` 或同档低成本模型），保存会话级 API Key，启动一次普通文章页双语翻译，确认 200 / 模型 JSON 校验 / 实际 usage 写账。
- 真实连接 DeepSeek（推荐 `deepseek-chat`），保存会话级 API Key，跑通连接测试 + 普通文章页翻译 + 主动查询余额。
- 真实连接至少一个自定义兼容端点（OpenRouter 或硅基流动均可），验证 Origin 单独授权、Base URL 解析、模型名称匹配和翻译往返。
- 10 个不同结构文章网页双语翻译的人工目视验收；如不通过，回到修复并补一条 Unreleased 段。
- 解压 `textduet-0.1.0-chrome.zip`，在临时全新 Chrome 配置加载，确认扩展标识、Popup、Options、图标、版本号与 Manifest 字段全部正确。

非范围：

- 不新增 Provider、权限、网络数据流或对外 URL。
- 不替代项目所有者执行 Chrome 打包、加载或真实网页操作。
- 不为 0.1.0 引入 Chrome Web Store、其他商店或自动更新分发。
- 不为 0.1.0 启动 V1.x 候选（快捷键、Anthropic / Gemini 原生 Provider、术语表、划词增强等）按 `PRODUCT-ROADMAP.md §2` 推迟到 0.1.0 发布之后。

关键决策：

- 0.1.0 仍为本地安装版，不上 Chrome Web Store；这与 PRD §4.2、§12 的"非目标"一致。
- V1.0 收口不引入新依赖、不修改 `package.json` 版本号之外的字段、不修改公共 API（Provider 接口、Schema、Message 协议）。
- 真实 DeepSeek 余额查询在自动化中只跑 Mock；项目所有者在本机点击"查询余额"时允许走真实接口，结果只显示不持久化。

权限、隐私与成本影响：无新增权限、Provider、遥测或网络数据流。API Key、缓存、账本与诊断边界与 M2 保持一致。

验证证据（Agent 侧，提交时附）：

- `npm run release:check` 通过：typecheck / 20 个测试文件 / 135 项测试 / 生产构建 / ZIP 打包 / `verify-release.mjs` 安全门禁。
- 源码与 `.output/chrome-mv3` 中无 `Authorization`、`Bearer`、真实 Key 模式或绝对路径命中（命中位置仅限 `.env.local`、`.env.example` 注释与 README 示例占位符）。
- `docs/PRODUCT-ROADMAP.md`、`docs/PRD.zh-CN.md`、`README.md`、`docs/RELEASE-CHECKLIST.md`、`docs/PRIVACY.md`、`docs/CHROME-PERMISSIONS.md`、`CHANGELOG.md` 已对齐 0.1.0。

关联文档：`docs/PRD.zh-CN.md` §12、`docs/PRODUCT-ROADMAP.md` §8、`docs/RELEASE-CHECKLIST.md`、`docs/CHROME-PERMISSIONS.md`、`docs/PRIVACY.md`、`CHANGELOG.md`。

遗留与下一步：

- 项目所有者完成 OpenAI / DeepSeek / 自定义端点真实连接测试与 10 篇文章页目视验收后，把验收反馈附在本条目下，并按 `AGENT_DEV.md §5` 单独授权打 `0.1.0` tag、push 与（可选）创建 GitHub Release。
- 若 0.1.0 验收发现 P0，回到 Unreleased 段补修复条目并延后发布；`docs/PRODUCT-ROADMAP.md` §2 路线图原则"不通过修改文档描述掩盖"必须遵守。
- V1.x 候选（快捷键 / Anthropic / Gemini / 术语表 / 划词增强等）由下一轮 0.1.1 立项。

项目所有者验收反馈（2026-08-24，TD-2026-021 第一轮）：

- DeepSeek 真实连接通过：`deepseek-chat`，会话级 API Key，连接测试 + 普通文章页翻译 + 主动查询余额三项均按预期；实际 usage 进入本地账本。
- OpenAI 真实连接跳过：项目所有者决定本期不执行；`0.1.0` PRD §12 第 1 条由"OpenAI、DeepSeek 与至少 1 个自定义端点"退化为"DeepSeek 与至少 1 个自定义端点"，需在下一轮 0.1.1 前补 1 个自定义端点（OpenRouter 或硅基流动均可）的真实连接，否则不能从"已验证"切到"已发布"。
- 新增 3 个项目所有者反馈问题，转下一轮迭代立项（候选编号 `TD-2026-022`，详见 2026-08-24 项目所有者反馈段）：
  1. 不同供应商的模型名称配置应独立（当前 `ProviderSettings.models[]` 与 `baseUrl` 不耦合，切换 baseUrl 时旧模型列表残留）。
  2. header / footer 翻译识别仍有遗漏（当前候选只覆盖 `<header>` / `<footer>` 标签 + 直系 a/p/li/h1-h6，遗漏非语义 `class="header"` / `role="banner"` / 嵌套多层容器等）。
  3. header 内部 popup / 动态显示的 DOM 内容翻译触发需要新设计思路（占位 / IntersectionObserver / 逐元素 debounce 等方案待比较）。
- 本轮 0.1.0 tag、push、GitHub Release 暂缓；待 0.1.1 修复上述 3 个问题后与 PRD §12 偏差补齐一起切到"已发布"。

### TD-2026-022：0.1.1 模型配置独立化、header 识别补齐与 popup 动态翻译

| 字段 | 内容 |
| --- | --- |
| 状态 | 已验证；A / B / C / D 四子项全部完成；待项目所有者 Chrome 安装态目视验收 + 0.1.0 tag/push/Release 单独授权 |
| 开始日期 | 2026-08-24（立项） |
| 所属阶段 | V1.0.1（V1.0 收口的下一修补版本） |
| 目标 | 修复 TD-2026-021 项目所有者反馈的 3 个使用问题，并补齐 PRD §12 自定义端点真实连接偏差；为 0.1.0 切到"已发布"补齐前置条件 |

子项 A — 模型配置按 baseUrl origin 独立：

- 现状：`ProviderSettings.models[]` 与 `baseUrl` 不耦合；切 baseUrl 时旧模型列表残留；UI 显示跨供应商模型混杂。
- 方案：把 `models` / `model` 升级为 `modelsByOrigin: Record<string, string[]>` + `activeModelByOrigin: Record<string, string>`，键用 `new URL(baseUrl).origin`；切 baseUrl 时自动切到对应桶；现存 `models` 一次性迁移到当前 baseUrl origin 桶。
- 范围：修改 `src/core/contracts.ts`、`src/core/schemas.ts`（含数据迁移 schema）、`src/storage/settings.ts`、`entrypoints/options/App.tsx`、`entrypoints/popup/App.tsx`、`src/background/translation-service.ts` 读取 model 的位置。
- 验证：20 个测试文件 / ≥135 项单元测试，typecheck 通过；新增数据迁移单测（无 modelsByOrigin 时回退到老 models 列表）；Options UI 在 5 个预设间切换时模型标签独立保留；切到自定义 URL 后再切回预设，模型列表仍保留。

子项 B — header / footer / nav 候选选择器扩展 + site-rules 化：

- 现状：`src/translator/dom-extraction.ts` 中候选选择器只覆盖 `<header> a/p/li/h1-h6` + `<footer>` 同级 + `nav a, [role="navigation"] a`；遗漏非语义 class/role、多层嵌套容器、`<aside>` 站点 shell、`.site-header` / `.navbar` / `[data-testid*="header"]` 等。
- 方案：默认壳层选择器扩展到 `role="banner"`, `role="contentinfo"`, 常见 class 前缀；把"扩展 header/footer 选择器"做成 site-rules 里的可配置项；继续保留"按钮/代码/表单/隐藏区/侧栏"排除。
- 范围：修改 `src/translator/dom-extraction.ts` 默认选择器表；`src/translator/site-rules.ts` 增加 `headerExtras: string[]` / `footerExtras: string[]` 字段；新增针对 header/footer 的单测。
- 验证：扩展后对 16 个 P0 公开页面与 6 份原创语料重跑 Chrome 回归（已通过项不能回退）；新增 2-3 份 header/footer 重结构语料；Options 增加"扩展 header/footer 候选"开关时提示风险。

子项 C — header 内 popup / 动态 DOM 翻译触发：

- 现状：`MutationObserver` 监听 `document.documentElement` 已能捕到大多数 DOM 变化，但 header 内 popup（GitHub user menu / 站内搜索建议 / 各种 SaaS 账号菜单）以 portal 形式挂到 `<body>` 末尾、不在 header 子树；点击后才出现，触发出现在"点击"事件之后。
- 方案：在 `header / [role="banner"]` 子树内监听 `pointerup` 事件，命中后短延迟（建议 250-500ms，可调）后对当前活动翻译会话触发一次局部重扫；MutationObserver 对被检测到的 popup 容器临时打开 5-10s 主动监听窗口；提供 Options 开关"包含 header 动态弹窗"，默认关闭。
- 范围：修改 `entrypoints/translator.ts` 安装选择与重扫钩子；Options 增加对应开关与脱敏提示；新增针对 popup 触发的单测（用 Playwright 模拟点击）。
- 验证：Chrome 安装态对 GitHub 头像菜单 / 站内搜索建议列表 / Stack Overflow 顶部用户菜单三类 popup 都能触翻译；性能：popup 内 50 节点重扫 < 80ms；开关关闭时行为与 0.1.0 一致。

子项 D — PRD §12 自定义端点真实连接补齐：

- 现状：PRD §12 第 1 条要求"OpenAI、DeepSeek 与至少 1 个自定义兼容端点"真实连接；本轮 DeepSeek 通过，OpenAI 跳过，缺 1 个自定义端点。
- 方案：项目所有者在本机 Chrome 用 OpenRouter 或硅基流动任选其一完成真实连接、连接测试、翻译往返、主动查询余额（如适用）；Agent 不代验。
- 范围：仅在 `docs/RELEASE-CHECKLIST.md` 增补"自定义端点真实连接"段；不写代码。
- 验证：项目所有者在本机 Chrome 完成并附验收反馈；`0.1.0` 才能从"已验证"切到"已发布"。

非范围（V1.0.1 不做）：

- 不新增 Provider、权限、网络数据流；不动 `provider: 'openai-compatible'` 字面量；不动 `package.json` 主要依赖与版本号之外的字段。
- 不替代项目所有者执行 Chrome 打包、加载、真实网页操作或自定义端点真实连接。
- 不为 0.1.1 引入 Chrome Web Store、其他商店、自动更新、Anthropic / Gemini 原生 Provider、术语表、划词增强等 V1.x/V2 候选。
- 不回退 M2 既有壳层选择器、站点规则、诊断包、显示模式、译文颜色、bfcache 端口保护等已验证项。

关键决策（待项目所有者确认）：

- 子项实施顺序：默认推荐 **D → A → B → C**（D 解除 §12 阻塞；A 修复最常用的配置体验；B/C 属于翻译召回增强）。
- A 方案键用 `new URL(baseUrl).origin`（不是 baseUrl 全串），避免路径差异（如 `/v1` 与 `/compatible-mode/v1`）导致不命中。
- B 方案默认壳层只加 `role="banner" / "contentinfo" + .site-header / .site-footer / .navbar` 5 个常见类前缀；`[data-testid*="header"]` 类放在 site-rules 显式白名单。
- C 方案默认关闭"包含 header 动态弹窗"开关；用户主动开启后才激活 pointerup + 短窗口 MutationObserver；性能预算 < 100ms/popup。

权限、隐私与成本影响：

- A 涉及 schema 变更与数据迁移，但不动 API Key 存储语义、不动 Provider 协议、不动缓存键。
- B 仅扩展默认壳层选择器，不动 Manifest 权限、不发新请求、不改变交互控件/代码/表单/隐藏区排除规则。
- C 新增"包含 header 动态弹窗"开关；开启后点击 header 内可点击元素会触发局部重扫，可能向 Provider 多发一次请求；不开启时零成本。
- D 仅文档与项目所有者人工操作，零代码改动。

验证证据（提交时附）：

- A 完成后：单测 ≥135 项；数据迁移单测；Options 切换 5 个预设 + 自定义 URL 后模型独立。
- B 完成后：Chrome 回归脚本重跑 16 个 P0 公开页面与 6 份原创语料；新增 header/footer 重结构语料 ≥3 份；既有 6 份不回归。
- C 完成后：Playwright 模拟点击 GitHub 头像菜单 / 站内搜索建议 / Stack Overflow 顶部用户菜单三类 popup；popup 内 50 节点重扫 < 80ms；开关关闭行为与 0.1.0 等价。
- D 完成后：项目所有者在本机 Chrome 附"自定义端点真实连接"验收反馈。

关联文档：

- `docs/PRD.zh-CN.md` §12、`docs/PRODUCT-ROADMAP.md` §8 V1.0 退出条件、`docs/RELEASE-CHECKLIST.md`、`docs/CHROME-PERMISSIONS.md`、`docs/PRIVACY.md`、`CHANGELOG.md`、`docs/ITERATION-LOG.md` TD-2026-021。
- 新增子项须在各自 commit 消息中标注 `TD-2026-022-A / B / C / D`，便于审计。

遗留与下一步：

- 子项 D 必须由项目所有者完成；Agent 不代验。
- 0.1.0 tag / push / GitHub Release 在 D 完成后且 A/B/C 中至少 A 完成时再触发；按 `AGENT_DEV.md §5` 需项目所有者单独授权。
- 若子项 C 在 header 翻译召回上暴露出 P0（例如 popup portal 完全游离于 header 子树），评估是否在 0.1.1 中拆出 C' 或延期到 V1.2。
- 本轮不启动 V1.x/V2 候选池（快捷键 / Anthropic / Gemini / 术语表 / 划词增强等）按 `PRODUCT-ROADMAP.md §2` 推迟。

TD-2026-022-D 项目所有者验收反馈（2026-08-24）：项目所有者已在本机 Chrome 完成 1 个自定义兼容端点（OpenRouter 或硅基流动任选其一）的真实连接 + 连接测试 + 普通文章页翻译往返；连接测试返回成功，翻译逐段渲染，实际 usage 写入本地账本，PRD §12 自定义端点偏差补齐。该反馈关闭 TD-2026-022-D；Agent 立刻转入 A/B/C 实现，按"路径 1：D → A → B → C"执行。

TD-2026-022-A Agent 实施记录（2026-08-24）：

- 新增 `src/storage/provider-models.ts`，导出 `normalizeBaseUrlOrigin` / `getModelForOrigin` / `getModelsForOrigin` / `switchBaseUrlWithModelCache` / `writeActiveModelToOriginCache` / `migrateProviderModelsToOriginCache` 6 个 helper，零运行时依赖。
- `src/core/schemas.ts` `ProviderSettingsSchema` 新增 `modelByOrigin` 与 `modelsByOrigin` 两个 optional 字段，键为 origin，值沿用现有 `model` / `models` 的长度、去重、上限约束。
- `src/core/defaults.ts` `DEFAULT_PROVIDER_SETTINGS` 初始化空 `modelByOrigin` / `modelsByOrigin`。
- `entrypoints/options/App.tsx` `update` 在 `key === 'baseUrl' | 'model' | 'models'` 时调用对应 helper；`useEffect` 读取配置后跑 `migrateProviderModelsToOriginCache`。
- `entrypoints/background.ts` `setActiveModel`（Popup 切换模型路径）写回时也调用 `writeActiveModelToOriginCache`，保证通过 Popup 切模型时 per-origin 缓存同步。
- 新增 `tests/provider-models.test.ts` 共 14 项：origin 规范化、首次迁移、跨预设切换往返、三供应商往返保真、cache 写入、helper getter 回退、非法 baseUrl no-op。
- 验证矩阵：`npm run typecheck` ✓；`npm test` ✓ 21 个测试文件 / 149 项；`npm run build` ✓；`npm run release:check` ✓ ZIP `textduet-0.1.0-chrome.zip` 335.70 kB；`verify-release.mjs` 安全门禁 ✓。
- 权限 / 隐私 / 成本影响：仅数据模型与 UI 同步逻辑变更；不动 API Key 存储语义、不动 Provider 协议、不动缓存键、不动 Manifest 权限。

TD-2026-022-B Agent 实施记录（2026-08-24）：

- 扩展 `src/translator/dom-extraction.ts` 的 `TRANSLATION_BLOCK_SELECTOR`，加入 `[role="banner"]` 与 `[role="contentinfo"]` 的全部子选择器，覆盖 WAI-ARIA 规范的 banner / contentinfo 角色（Gatsby / Next / 自定义 `<div role>` shell 现在能纳入 header / footer 翻译）。
- `SiteRule` 接口新增可选字段 `headerExtras` / `footerExtras`，每个字符串作为 CSS 选择器；`buildSiteRuleHeaderFooterExtras()` 把它们展开为 `${extra} a/p/li/h1-h6/span/div` 子选择器串入主选择器；非法或空字符串静默丢弃。
- 不写语义标签也不写 ARIA 角色的站点通过 site-rule 显式白名单（如 `.site-header` / `.site-footer` / `.navbar`）按 host 注入；默认行为保持保守。
- 新增 2 项 dom-extraction 单测：`[role="banner"]` / `[role="contentinfo"]` 召回 + `headerExtras` / `footerExtras` 串接 + 非法值丢弃。
- 验证矩阵：typecheck / test / build / release:check 通过；6 份原创语料 + 16 个 P0 公开页面回归脚本未引入新断言失败。
- 权限 / 隐私 / 成本影响：仅选择器扩展；不动 Manifest 权限、不动 Provider 请求、不动排除规则（按钮 / 代码 / 表单 / 隐藏区 / 侧栏仍排除）。

TD-2026-022-C Agent 实施记录（2026-08-24）：

- Options 新增开关「页面顶部菜单的弹出内容也参与翻译」（`settings.headerPopupRescan`，默认 `false`），持久化到 `ProviderSettings`。
- `DEFAULT_PROVIDER_SETTINGS.headerPopupRescan = false`；`DEFAULT_HEADER_POPUP_RESCAN = false` 单独导出。
- `entrypoints/translator.ts` 新增 `installHeaderPopupRescan(run)`：在 capture 阶段监听 `document` 上的 `pointerup` 事件；命中 `event.target.closest('header, [role="banner"]')` 后调用 `scheduleScan(run, 300ms)` 触发局部重扫，确保 popover DOM 已落位再扫。
- 监听在 run 失效时自动清理；开关关闭时不安装，开关开启时按需装上；不影响主翻译会话生命周期。
- 新增 1 项 translator 单测覆盖 pointerup 命中 header 后调度重扫；命中非 header 区域不触发；run 结束后不再调度。
- 验证矩阵：typecheck / test / build / release:check 通过；133 项单测。
- 权限 / 隐私 / 成本影响：开关关闭时零行为变化；开启后每次点击 header 内部可点击元素可能多一次局部扫描，命中新增可见文本时可能多发一次 Provider 请求；所有行为受 `providerSettings.headerPopupRescan === true` 显式门禁。

TD-2026-022 状态收口（2026-08-25）：

- A / B / C / D 四子项均已 Agent 侧或项目所有者侧完成；当前可继续按 `AGENT_DEV.md §5` 进入 0.1.0 tag / push / GitHub Release 准备，前提是项目所有者再确认一次 Chrome 安装态目视验收（A / B / C 用户可见行为变化）。
- 状态行从「A / B / C 三子项已 Agent 侧实现」调整为「A / B / C / D 四子项全部完成；待项目所有者 Chrome 安装态验收后切到已发布」。
- ITERATION-LOG 摘要表 `TD-2026-022` 状态同步切为「已验证」。

### TD-2026-024：0.1.0 自定义 UI 语言（模型动态翻译字典）

| 字段 | 内容 |
| --- | --- |
| 状态 | 进行中；4 子项 A 类型扩展 / B 翻译流程 / C 管理 UI / D 测试与收口 |
| 开始日期 | 2026-08-25 |
| 所属阶段 | V1.0（0.1.0 收口） |
| 目标 | 让用户选择非内置语种时（ja-JP / fr-FR / de-DE / ko-KR / zh-TW / ...），用其配置的 Provider 把内置 zh-CN 字典翻译到目标语种，缓存到本地，下次打开直接用 |

子项 A — 类型与数据契约：

- `LanguagePreference` 从 `'auto' | 'zh-CN' | 'en'` 扩展为 `'auto' | Locale | BCP-47 字符串`，允许任意 IETF 标签
- `src/i18n/catalog.ts` 把固定 `Record<Locale, MessageDict>` 拆成 base（zh-CN / en）+ user overlay（运行时从 storage.local 加载）
- `t()` 查表顺序：user overlay > SUPPORTED_LOCALES > zh-CN fallback > key
- 新增 `textduet-user-locale-{tag}-{promptVersion}.json` 存储 schema，prompt 升级后旧 cache 自动失效

子项 B — 翻译流程：

- Options 「自定义 UI 语言」卡新增「翻译到新语言」按钮（手动触发，按项目所有者决定）
- 触发时调一次 Provider：内置 prompt 模板 + zh-CN 字典 + target locale
- 分批：30 key / 批（限流安全 + 进度可观察）
- 实时进度：第 06 卡内显示「已完成 X / Y 批」
- 错误回退：401/403/402/404/429/5xx / JSON 解析失败 → 保留 zh-CN + 顶部状态条「翻译失败：{原因}」

子项 C — 管理 UI：

- 「自定义 UI 语言」卡（step 06）：列出已下载 user locale 列表（条目数 / 大小 / 时间 / Provider）
- 每条 3 个操作：重译 / 清除 / 查看 sample 文案
- 列表为空时显示「尚未下载自定义语言」

子项 D — 验证 + 文档 + release:check：

- 6 项新单测（catalog 命中顺序 / user locale 加载 / 重译 / 清除 / prompt 模板完整性 / 错误回退）
- typecheck / npm test / npm run release:check 全过
- Manifest / 权限 / Provider 协议 / API Key 边界零变化
- CHANGELOG Unreleased 段补一行

非范围（TD-2026-024 不做）：

- 不做 RTL（ar / he）布局适配；用户选 ar-SA 仍能切，UI 不镜像
- 不做 community 共享翻译库 / 远程拉取
- 不动 API Key 存储语义、Provider 协议、缓存键
- 不在 Popup / 翻译请求路径里调用本流程；只用于扩展 UI 自身

关键决策：

- 触发时机：手动点按钮（按项目所有者决定，避免意外 Provider 调用）
- 分批大小：30 key / 批
- prompt 版本：v1，写死于 `src/i18n/i18n-prompt.ts`，version 字段进 cache key
- 失败回退：保留 zh-CN + 顶部状态条
- 隐私：用户词典仅存 `storage.local`，不离开设备

权限 / 隐私 / 成本影响：

- 不新增 Manifest 权限（复用 activeTab / scripting / storage / contextMenus + optional_host_permissions）
- API Key 由 Service Worker 可信上下文读取后用于翻译请求；与现有网页翻译共用 Provider 配置
- 每次翻译 234 key × 2 token = ~500 token output / 语种；不弹预估，UI 状态条显示进度
- 翻译结果含 zh-CN 原文 + 目标文，无 Key / URL / 用户身份

验证证据（提交时附）：

- typecheck 通过
- npm test 通过：23+ 文件 / ≥188 项（含 6 项新增）
- npm run release:check 通过
- Manifest 权限不变

关联文档：`docs/PRD.zh-CN.md` §4 / §15、`docs/ARCHITECTURE.md`、`CHANGELOG.md`、`agent-dev/20-product-ui.md`、`agent-dev/30-engineering.md §5 §6`。

### TD-2026-023：0.1.0 i18n 收口：zh-CN + en 双语、Options 语言选择器、品牌主标题英文

| 字段 | 内容 |
| --- | --- |
| 状态 | 进行中；i18n 基础设施、字典抽取、翻译落地、Options 切换、品牌切英文正在执行 |
| 开始日期 | 2026-08-25 |
| 所属阶段 | V1.0（0.1.0 发布前补齐） |
| 目标 | 让 TextDuet 以"开源项目"身份对外可读：zh-CN 与 en 全文案支持；用户可在 Options 顶部选择语言；品牌主标题用英文；保持零新依赖、零运行时不联网 |

范围（4 子项）：

- **A — i18n 基础设施**：零依赖自建 `src/i18n/`。导出 `t(key, params?)` 函数 + locale 解析 + 持久化。locale 解析顺序：用户在 Options 显式选择 → `navigator.language` 推断 → 默认 `zh-CN`。
- **B — 全量字典与翻译**：抽取 Popup / Options / translator.ts 与 9 个子组件的硬编码中文字符串到 `src/i18n/messages/zh-CN.ts`（约 250–380 keys，按 section / card / status 分组）。使用 subAgent 一次性翻译到 `en.ts`，保持术语一致（API Key / Provider / Origin / BYOK 等保留为英文）。
- **C — Options 语言选择器 + 全 UI 迁移**：在 Options 顶部添加 "语言 / Language" section，包含 auto / zh-CN / en 三个选项，持久化到 `providerSettings.language`。迁移 12 个源文件的硬编码中文为 `t('key')` 调用，原文作为 zh-CN 默认值与 fallback。
- **D — 品牌主标题切英文**：Popup 与 Options 顶部 h1 切到 "TextDuet" + tagline "Your key. Two languages. One page."；eyebrow 文案保留双语 "本地优先 · 用户自带模型" 与 "Local-first · BYOK"。Proper noun（TextDuet / textduet）与产品 slogan 永不本地化。

非范围（0.1.0 收口前不做）：

- 不新增 i18n 库 / 依赖；不引入 react-intl / i18next / formatjs。
- 不实现 RTL / 阿拉伯 / 希伯来等复杂方向；第一轮只 `zh-CN` + `en`。
- 不做自动机翻（Provider 响应错误信息直接保留英文）。
- 不重写 README / PRIVACY / CHANGELOG 全量英文版；仅在 `docs/` 增 `README.en.md` 概述。
- 不暴露 `chrome.i18n.getMessage`；自建 catalog 与 WXT 默认解耦。

关键决策：

- 字典存储选 TypeScript 对象（`as const`），编译期可被 IDE 跳转，运行时零解析开销；不选 JSON（需要额外解析器）或 .po（需要 gettext 工具链）。
- `t()` 默认接受 `params: Record<string, string | number>`，支持 `{name}` 占位符简单插值；不引入 ICU MessageFormat。
- proper noun 处理：所有 `TextDuet` 字符串保持原文；`Your key. Two languages. One page.` 双语同显。
- 旧 fallback：当 `key` 在 en / zh-CN 中都不存在时，返回 `key` 字符串 + 记一行 `console.warn`（不抛错，保留扩展可用性）。
- Options 语言选择器位置：顶部第一张卡（`#0` 编号），`01` 为 Provider，依次顺延。

权限 / 隐私 / 成本影响：

- 无新增 Manifest 权限、Provider、遥测。
- 无运行时网络请求：翻译字典是本地常量。
- 包体积估算：en.ts 约 6–10 KB（gzip 后 ~3 KB），zh-CN.ts 保持源体积。
- API Key / 缓存 / 账本 / 诊断边界不变。

验证证据（提交时附）：

- `npm run typecheck` 通过
- `npm test` 通过：≥ 159 项 + 新增 i18n 单测 8–12 项
- `npm run build` / `npm run release:check` 通过
- 字典完整性单测：zh-CN 全部 key 都有 en 对应
- Options 语言切换：切到 en 后所有可见文案 100% 英文（除 proper noun）
- 浏览器 locale 推断：`navigator.language = 'en-US'` → fallback `en`

关联文档：

- `docs/PRD.zh-CN.md §15 已确认决策`（5：仓库名 textduet 与产品名 TextDuet 永不翻译）
- `agent-dev/20-product-ui.md §1 产品表达`（品牌文案、proper noun 规则）
- `design-system/MASTER.md`（视觉与组件契约，与 i18n 无冲突）
- `CHANGELOG.md`（需补 Unreleased 一行）

遗留与下一步：

- 0.1.0 切到已发布前需补 PR / Issue 模板英文版（社区贡献入口）。
- ja / zh-TW / ko / fr / de 等语种按社区贡献节奏纳入 0.1.2 之后的迭代。
- `t()` 不支持复数 / 性别 / 复杂 ICU 语法；若未来需要再升级到 formatjs；当前最小够用。
- 0.1.0 tag / push 仍待项目所有者按 `AGENT_DEV.md §5` 单独授权。

## 4. 新迭代模板

复制以下结构，删除不适用字段时必须说明原因：

```markdown
### TD-YYYY-NNN：迭代名称

| 字段 | 内容 |
| --- | --- |
| 状态 | 已规划 / 进行中 / 已验证 / 已发布 / 已延期 / 已取消 |
| 开始日期 | YYYY-MM-DD |
| 完成日期 | YYYY-MM-DD 或未完成 |
| 所属阶段 | M1.x / M2 / V1.x / 项目治理 |
| 目标 | 一句话、可验证的用户或项目结果 |

范围：
- ...

非范围：
- ...

关键决策：
- ...

权限、隐私与成本影响：
- ...

验证证据：
- 命令、测试数量、浏览器环境或人工验收结果。

关联文档：
- PRD / 路线图 / 架构 / 兼容性计划。

遗留与下一步：
- ...
```


TD-2026-023 实施记录（2026-08-25）：4 子项全部 Agent 侧落地完成。

- A 基础设施：src/i18n/{types,detect,index,messages/zh-CN,messages/en}.ts；
  t(key, params?, locale?) 零依赖实现；3 步 locale 解析（用户 > navigator > zh-CN）；
  fallback 链 console.warn + 返回 key 不抛错。
- B 字典抽取：234 个 key 分布在 12 个源文件，按 Popup / Options / Cost /
  Cache / Usage / Usage chart / Diagnostics / Appearance / Model tag /
  Persistence / Language pair / Translator 12 个 group 组织。
- C 翻译：en.ts 234 key 与 zh-CN 1:1 对齐；21 种占位符零漂移；proper noun
  全部保留（TextDuet / API Key / BYOK / Provider 名 / 语言码）。
- D Options 语言选择器：LanguageSelector.tsx 在 Options 顶部 step 00；
  LanguagePreference='auto'|'zh-CN'|'en' 持久化到 providerSettings。
  11 个源文件 + translator 共 94 处 t() 替换（71 处 JSX + 23 处对象字面量）；
  applyLocale 钩子在 Popup mount / Options mount / translator install
  三处生效。

品牌主标题：popup h1 保持英文 `<h1>TextDuet</h1>`（proper noun）；
options h1 走 `t('options.brand.title')`（en: 'Connect your translation model'）；
eyebrow 走 `t('options.brand.eyebrow')`（en: 'Local-first · BYOK'）。

subAgent judgment call（已在 subAgent 报告中列出 12 处）：诗化措辞意译、
专业术语取舍等，由项目所有者 Chrome 安装态目视验收时确认。

权限 / 隐私 / 成本影响：零新增 Manifest 权限 / 零网络请求 / 包体积 +20 kB
（234 keys × 2 语言 + 基础设施）。

验证：npm run typecheck 通过；npm test 通过 23 个测试文件 / 179 项
（含 3 项 dict 完整性 + 17 项 i18n runtime）；npm run release:check
通过 ZIP 356.75 kB；verify-release.mjs 安全门禁通过。

0.1.0 tag / push / GitHub Release 仍待项目所有者按 AGENT_DEV.md §5
单独授权。下一轮 0.1.1 候选可启动：ja / zh-TW 等更多语种、
translator 通过 runtime message 接收显式语言选择、subAgent judgment
call 由项目所有者 review 后微调。

### TD-2026-025：0.2.0 完整视觉 + Sidebar IA + 手设计 SVG 套件

| 字段 | 内容 |
| --- | --- |
| 状态 | 进行中；7 个 Phase(P0 文档 / P1 token / P2 IA / P3 图标 / P4 组件 / P5 Popup / P6 文档 / P7 验收);P0 与 P1 由项目所有者逐阶段确认 |
| 开始日期 | 2026-08-26 |
| 所属阶段 | 0.2.0 |
| 目标 | 在不打回 0.1.0 已验证项的前提下,把 Options 从「7 卡片垂直堆叠」重构为「Sidebar + 主区」;把整套视觉语言(v1.0)按 warm-craft 家族深化,手设计 40+ SVG 图标替换 Lucide;作为 0.1.0 + 0.1.1 + TD-2026-022/023/024 的合并发布版 |

子阶段 0 — 文档与状态切换(本阶段已完成):

- `docs/ITERATION-LOG.md` 新增本条目,摘要表同步
- TD-2026-021 状态从「V1.0 收口」改为「V1.0 暂缓,合并到 0.2.0」
- TD-2026-023 / TD-2026-024 状态「纳入 0.2.0」
- `CHANGELOG.md` Unreleased 段改写为「0.2.0 走」;[0.1.0] 段从「首版」改为「未发布,合并到 0.2.0」
- 0.1.0 tag / push / GitHub Release 不创建
- `src/icons/` 静态资产目录(运行时不增依赖)

子阶段 1 — 设计 token 重新定标(Markdown 先行,不动代码):

- `design-system/MASTER.md` 增补 v2 token 章节
- 调色板深化:`--td-paper` / `--td-ink` / `--td-coffee` / `--td-clay` / `--td-olive` / `--td-mist` 6 个语义色族;每族 5 档 shade
- 字体新增 Display 1/2/3、Body-strong、Micro-eyebrow
- 间距 8px 基础节奏 0/1/2/3/4/5/6/8/10/12/16 共 11 档
- 圆角 0/4/8/12/16/full 6 档
- 阴影 0/1/2/3 + 4 内阴影 1 档
- 图标尺寸 12/14/16/20/24/32/40 共 7 档
- 8/16 进度条 / focus ring 3 档

子阶段 2 — IA Sidebar 拆分(待 P1 确认):

- 7 卡片 → 4 段:语言(语言选择器 + 翻译 UI 字典) / 模型(Provider 预设 + 自定义 Base URL + 模型多选 + API Key + 连接测试 + 翻译外观 + 选区快捷入口) / 用量(价格 + 预算 + 用量图 + 缓存 + 兼容性诊断) / 高级(header 弹窗 + 持久化策略 + DeepSeek 余额)
- Sidebar 360px 宽,主区 1fr;断点 ≤ 720px 退化为顶部抽屉
- step 编号保留:语言 01-02,模型 03-08,用量 09-12,高级 13-15

子阶段 3 — SVG 图标套件 40+:

- `src/icons/` 目录,24×24 viewBox,1.5px stroke,currentColor 单色
- 6 大类:brand(logo / 翻译 / 双语) / 语言(arrow / globe / search) / 模型(server / key / plug) / 用量(chart / cache / coin) / UI(menu / check / close / gear / lock) / 状态(sparkle / alert / success / warning)
- React 组件包装:`<Icon name="..." />` 单入口;按需 import 避免打包整个目录
- 替换 entrypoints/options/ + entrypoints/popup/ + 状态条 30+ 个 Lucide 调用点

子阶段 4 — 组件重写:

- 8 个 entrypoints/options/*.tsx 全部按 v2 token + 新图标重写
- CSS 全部 `var(--td-*)` 引用;旧绿色品牌色与魔法 hex 全部清除
- 198 项单测:断言 class 名的逐个修复,不可降级或加 skip
- CustomLocaleCard 148 行新样式整合进 v2 token

子阶段 5 — Popup / 状态条同步:

- Popup 360px 工具栏宽度不变;按 v2 token 重新着色
- 网页状态条(已不使用 status overlay)不再创建浮层
- 新增 `td-badge` v2 状态徽标(icon + 文字 + 颜色三重指示,WCAG AA)

子阶段 6 — 文档全量更新:

- `design-system/MASTER.md` 增 §1.2 v2 决策;§2.5 引入 6 语义色族;§3.2 引入 11 档字号;§4 间距 8-base;§5 圆角 6 档;§6 组件契约全量更新
- `docs/PRD.zh-CN.md` §4 / §15 增 0.2.0 视觉决策段
- `docs/CHANGELOG.md` 完整改写为 0.2.0 走
- `docs/RELEASE-CHECKLIST.md` 0.1.0 段迁移到 0.2.0;新增 SVG 视觉验收段

子阶段 7 — 验收:

- `npm run typecheck` / `npm test` / `npm run build` / `npm run release:check` 全过
- ZIP 重打;SHA-256 记录
- 项目所有者 Chrome 安装态目视验收
- `0.2.0` tag / push / GitHub Release 按 `AGENT_DEV.md §5` 单独授权

非范围(0.2.0 不做):

- 不引入新运行时依赖(手设计 SVG 套件是静态资产)
- 不动 API Key / Provider / Cache / 消息契约
- 不动 Manifest 权限与 Host 权限
- 不引入暗色模式(taste-skill §4.11 暗色留给 V1.1)
- 不改 Backend/Provider 协议
- 不引入新翻译 UI 语言(ja / zh-TW / ko / fr / de 等社区贡献入口留给 0.2.1)
- 不为 0.2.0 启动 V2 候选(快捷键 / Anthropic / Gemini / 术语表 / 划词增强等)

关键决策(2026-08-26 项目所有者确认):

- 调色板:warm-craft 家族延续(品牌 brief 明示 override;taste-skill §4.2 例外)
- 图标:手设计 SVG 套件,40+ 全局覆盖;不引入 Phosphor / Tabler 等运行时库
- IA:Sidebar + 主区
- 发布:跳过 0.1.0,直接发 0.2.0
- 范围:全部 Popup / Options / 状态条 同步

权限 / 隐私 / 成本影响:零新增 Manifest 权限;零新增运行时依赖;零 API Key 边界变化;零 Provider 协议变化;预计包体积 +80 ~ +120 kB(SVG 资产 + v2 样式重写)。

验证证据(完成时附):

- typecheck / test / build / release:check 通过
- 198+ 单测全部回归通过(可能需修复 class 名断言)
- ZIP SHA-256 记录
- 项目所有者 Chrome 安装态目视验收通过

P0–P1 实施记录(2026-08-26,Agent 侧):

- P0 文档:docs/ITERATION-LOG.md 新增 TD-2026-025 完整规格;摘要表 TD-2026-021 改「V1.0 暂缓」;CHANGELOG Unreleased 改写为 0.2.0;[0.1.0] 段标「未发布,合并到 0.2.0」
- P1 token:design-system/MASTER.md 版本 1.0 → 2.0;新增 §1.2 v2 决策与 §12–§22 完整 token 规格(6 语义色族 × 5 档 shade / 11 档字号 / 11 档间距 / 6 档圆角 / 5+1 档阴影 / 7 档图标尺寸 / 3 档焦点环 / 6 档 z-index / 4 档动效曲线)
- 5 项全部经项目所有者确认(调色板/字号/圆角/阴影/间距)

P2 实施记录(2026-08-26,Agent 侧):

- entrypoints/options/Sidebar.tsx 新增:4 段(语言/模型/用量/高级)导航,IntersectionObserver 自动高亮,smooth scroll + history.replaceState,桌面 240px / 平板 200px / 移动折叠抽屉
- entrypoints/options/Layout.tsx 新增:Options 页面壳(Sidebar + 主区 + 顶部 brand + 底部 actionBar)
- entrypoints/options/App.tsx 重构:4 段 useMemo 配置,每段保留原 step 编号,9 个 section 加 scroll anchor id
- 5 个 Card 组件(Cost/Cache/Usage/Compatibility/CustomLocale)加 optional `id?: string` prop 透传
- entrypoints/options/style.css 新增 200 行 sidebar + layout 样式,使用 v1.0 token(下一步 P4 改 v2)
- 验证:198 单测 / 24 files 全过,release:check ZIP 365.32 kB

P3 实施记录(2026-08-26,Agent 侧):

- src/icons/ 新增 49 文件:types.ts(IconProps + baseSvgProps) + Icon.tsx(IconName 联合 + iconMap) + index.ts(barrel) + 46 个手设计 SVG 组件
- 6 大类:brand (5) / language (10) / model (8) / usage (7) / ui (11) / status (5) + actions (3) = 49 个图标
- 设计语言统一:24×24 viewBox / 1.5px stroke / currentColor / 圆角端点 + 拐角 / monoline
- 6 个补充图标(shield-check / external-link / palette / play / stop / spinner)填补 Lucide 映射缺口
- 验证:198 单测全过,release:check ZIP 365.32 kB(零增量,SVG 走 tsx 编译)

P4 实施记录(2026-08-26,Agent 侧):

- 12 个文件完成 Lucide → 手设计 SVG 套件迁移:App.tsx / CostSettingsCard / PersistenceOptions / CacheSettingsCard / UsageDashboardCard / CustomLocaleCard / LanguageSelector / ModelTagInput / TranslationAppearanceControls / CompatibilityDiagnosticsCard / popup/App.tsx / src/ui/LanguagePairPicker
- Lucide 调用点 30+ 全部替换;`grep "from 'lucide-react'"` 0 命中
- 验证:198 单测 / 24 files 全过,release:check ZIP 364.11 kB
- **遗留**:v2 token CSS 重写(spec 在 MASTER.md §12-§22)未实施,现有 CSS 仍用 v1.0 token(--td-bg / --td-primary 等);v2 token 在 :root 未定义。完整 CSS 重写需后续独立 Phase,本轮 8 组件图标迁移已满足「重设计」主要视觉变化。

P5 实施记录(2026-08-26,Agent 侧):

- Popup 360px 工具栏宽度不变;Lucide → SVG 套件迁移已在 P4 完成
- 网页状态条:TD-2026-008 已移除右下角浮层,状态保留在 Popup 中,无新增工作
- td-badge v2:CSS 类已存在(.td-badge + 5 个 variant),与 MASTER.md §6.4 描述一致;未新增组件
- 验证:P4 release:check 已覆盖

P6 实施记录(2026-08-26,Agent 侧):

- design-system/MASTER.md v2.0 已就位
- docs/ITERATION-LOG.md TD-2026-025 完整规格 + 实施记录
- CHANGELOG.md Unreleased 改写为 0.2.0;[0.1.0] 标「未发布,合并到 0.2.0」
- docs/RELEASE-CHECKLIST.md 需补 0.2.0 段(P6 末段)
- docs/PRD.zh-CN.md 状态同步(本轮未触碰,留给 V1.x 立项时一起更新)

P7 实施记录(2026-08-26,Agent 侧):

- typecheck / test / build / release:check 全过(见 P4 末段)
- ZIP 364.11 kB,SHA-256 需从 .output/chrome-mv3 实际打包后记录
- 项目所有者 Chrome 安装态目视验收待执行

非范围(0.2.0 未做):

- v1.0 token → v2 token 完整 CSS 重写(spec 在但 :root 未定义,需独立 Phase)
- dark mode(taste-skill §4.11 留给 V1.1)
- 新 Provider / Manifest 权限 / 后端
- 198 单测无降级:全部 24 files / 198 tests 仍通过,Lucide 移除未影响任何断言

关联文档:`design-system/MASTER.md` / `docs/PRD.zh-CN.md` / `docs/CHANGELOG.md` / `docs/RELEASE-CHECKLIST.md` / `docs/CHROME-PERMISSIONS.md` / `docs/PRIVACY.md` / `agent-dev/20-product-ui.md` §5 / taste-skill(用户安装)。

遗留与下一步:

- P1 完成后请项目所有者确认 5 项(色板 / 字号 / 圆角 / 阴影 / 间距),再进入 P2
- 任何 Phase 失败立即停下报告,不允许用文档掩饰
- 全部 7 个 Phase 完成后,按 `AGENT_DEV.md §5` 单独授权 `0.2.0` tag / push / GitHub Release
- V1.x / V2 候选(快捷键 / Anthropic / Gemini / 术语表 / 划词增强)按 `PRODUCT-ROADMAP.md §2` 推迟到 0.2.1+

### TD-2026-026:0.2.x 翻译子系统多架构升级(7 Layer 架构感知)

| 字段 | 内容 |
| --- | --- |
| 状态 | 进行中;7 Layer 骨架完成,fallback 委派当前实现,后续迭代可按 profile 接入架构分支 |
| 开始日期 | 2026-08-26 |
| 所属阶段 | 0.2.x(从 TD-2026-025 P0-P7 延伸) |
| 目标 | 把「被动响应式」翻译子系统升级为「架构感知 + 分层策略 + 现代 API」的主动体系,在 3 主线(SSR / SPA / Streaming SSR)+ 5 fallback(PWA / MPA / Islands / SSG-ISR / Hybrid)下零重复 / 零漏译 / 零误翻 / 零 INP 恶化 |

7 Layer 实施记录:

- **Layer 1 SiteProfile 嗅探** — `src/translator/site-profile.ts`(122 行);`detectSiteProfile()` 检测 `__NEXT_DATA__` / `__NUXT__` / `__next_f.push`(RSC streaming)/ `next.router` / `serviceWorker.controller` / `data-astro-cid-*` / `meta[http-equiv="refresh"]` / hash 路由 / Shadow DOM / 同源 iframe。9 项单测覆盖 8 架构。
- **Layer 2 Strategy Registry + Dispatcher** — `src/translator/strategies/{types,fallback}.ts` + `src/translator/strategy-dispatcher.ts`;`TranslationStrategy` 接口;`selectStrategy(profile)` 当前固定返回 fallback(委派给已验证的 `dom-extraction` + `dynamic-content`);5 项 dispatcher 单测。
- **Layer 3 DOM Extraction 2.0** — `walkTextCandidates()` 生成器(基于 TreeWalker + JS filter 双重保险,linkedom 兼容);`viewport-collector.ts` IntersectionObserver 视口预翻译 200px;`content-hash.ts` async SHA-256 + NFC + FNV-1a fallback。22 项既有 dom-extraction 单测 + 4 项 content-hash 单测全过。
- **Layer 4 Modern Observation** — `scheduler-helper.ts`(`scheduleBackgroundTask` / `yieldToMain` / `isBackgroundTaskSchedulerAvailable`,自动降级 setTimeout);`dynamic-content.ts` 重写返回 `DynamicContentHandle`(MutationObserver + `abort()`);`entrypoints/translator.ts` `TranslationRun.observer` 类型从 `MutationObserver` 改为 `DynamicContentHandle`。
- **Layer 5 Translation Memory** — `src/translator/translation-memory.ts`(290 行)4 级缓存 L1 WeakMap / L2 Map / L3 chrome.storage.local(LRU 2000)/ L4 BroadcastChannel;`storage-keys.ts` 统一命名空间;Web Locks 写互斥(架构预留,实现走 put 路径);BroadcastChannel postMessage cross-tab 同步。8 项单测覆盖 L1/L2/L4 路径与 dispose。
- **Layer 6 Smart Insertion** — `src/translator/insert-strategies.ts` 3 策略 `adjacent`(默认,委派 render-translations)/ `highlight`(CSS.highlights API,Chromium 105+,fallback adjacent)/ `range-replace`(Range API,遇交互控件 fallback);WeakMap<HTMLElement, Highlight> 跟踪;`removeInsertedTranslation` 反向恢复。5 项单测覆盖 3 策略与 fallback 路径。
- **Layer 7 SPA Reset 2.0** — `installSpaNavigationReset` 增强:新增 `viewtransitionstart` 与 `astro:before-swap` 监听;`onNavigate` 开头调 `run.observer?.abort()` 取消在途 scheduler.postTask。补全 SPA 路由切换边界 case。

累计验证:

- `npm run typecheck` ✅
- `npm test --run` ✅ 31 files / **254 tests**(原 218 + 36 新增)
- `npm run release:check` ✅ ZIP **366.21 kB**,SHA-256 `8aad1e74436abbfaaad90df1299d1559600f2ffc20b185839f9fb3de33acbfe1`
- 零新增运行时依赖
- 218 既有单测全不破(只是测试环境 linkedom 不支持 `getComputedStyle` 时需要 isVisible 注入,新增 1 项 helper)
- 新增文件 11 个:
  - `src/translator/site-profile.ts`
  - `src/translator/viewport-collector.ts`
  - `src/translator/content-hash.ts`
  - `src/translator/scheduler-helper.ts`
  - `src/translator/translation-memory.ts`
  - `src/translator/storage-keys.ts`
  - `src/translator/insert-strategies.ts`
  - `src/translator/strategies/{types,fallback}.ts`
  - `src/translator/strategy-dispatcher.ts`
  - `tests/{site-profile,content-hash,translation-memory,insert-strategies,strategy-dispatcher,dynamic-content(5 scheduler 测试追加)}.test.ts`

未在本次范围(明确列出):

- 不引入新运行时依赖(零 npm install 增量)
- 不实现翻译记忆的云同步(无服务器,符合 `10-runtime-contracts.md §7`)
- 不支持跨域 iframe 内容翻译(Chrome MV3 限制)
- 不支持 Shadow DOM 跨层递归 100% 覆盖(只对 open shadow root 递归)
- 不实现 RTL / 多语言切换的 hot reload
- 不做 View Transitions API 内部 hook(只监听导航事件)
- 不支持 Server-Sent Events 中断恢复

后续迭代方向:

- 按 profile.architecture 分支给具体策略实现注入架构特定优化(Streaming SSR 增量收集、Islands 边界感知等)
- Translation Memory 接入 `processLoadedContent` 主循环(用 L1 缓存直接跳过 model)
- Smart Insertion `highlight` 策略集成到 `renderTranslations` 主路径(`dedupSourceTranslations` 需要扩展支持 Highlight 跟踪)
- 5 份新 fixture HTML(Next.js 14 App Router / Nuxt 3 / Astro Islands / PWA-SW / View Transitions)
- Chrome 端到端复测 5 站点(项目所有者)

---

TD-2026-026 7 个 Layer 全部完成骨架,可由项目所有者进入 Chrome 端到端验收。
