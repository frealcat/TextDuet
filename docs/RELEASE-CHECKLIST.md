# TextDuet 0.1.0 本地安装版验收清单

TextDuet `0.1.0` 只交付可本地加载的 Chrome 扩展包。以下清单用于生成和验收 `0.1.0` 候选包，不包含 Chrome Web Store、其他商店、自动更新、Git tag 或远端推送。

## 自动门禁

- [x] 在干净依赖环境执行 `npm ci`。
- [x] 执行 `npm run release:check`，确认类型检查、全部单测、生产构建、ZIP 和安全扫描通过。
- [x] 确认生产 Manifest 只有 `activeTab`、`scripting`、`storage` 和按需 HTTPS Provider Origin。
- [x] 确认无静态内容脚本、静态 `host_permissions`、远程可执行脚本、真实 Key 或个人绝对路径。

## Chrome 安装态验收

- [x] 从最终 ZIP 解压后，以全新 Chrome 配置加载其中的生产扩展，而非开发服务器版本。
- [x] Options、Popup、图标和版本号显示正确，桌面与 390px 窄屏无目标区域溢出。
- [x] 使用既有真实 Qwen 受控验收验证连接、公开页翻译和实际 usage 入账；使用候选包 Mock/缓存回归验证停止、缓存复跑和本地清理。
- [x] 抽查海外社区、框架官方文档、创意设计站、GitHub README 和学术页面；页面无需登录且实际可访问。
- [x] 访问保护、登录墙、验证码或付费墙只记为环境状态，不计入产品失败。
- [x] 对照真实 Provider 响应 usage 与本地账本；厂商账户后台金额未核查，不宣称金额一致。

## 文档与本地交付资料

- [x] `README`、PRD、路线图、迭代记录、CHANGELOG 与实际构建一致。
- [x] README 明确 ZIP 解压、本地加载、更新后重建/刷新和模型可能收费。
- [x] 隐私政策与 Chrome 权限说明覆盖本地安装包的实际数据流。
- [x] 项目所有者已说明：每个版本的 Chrome 打包、加载和人工验收由项目所有者完成；Agent 不代替声明安装态通过。

## 产物记录

记录候选版本、Git 状态、Node/Chrome 版本、检查日期、ZIP 文件名与 SHA-256。ZIP 是传输归档，Chrome 需要加载其解压后的扩展目录。失败项必须回到 `Unreleased` 或迭代遗留问题，不能通过修改文档描述掩盖。

## 本次验收记录

| 字段 | 结果 |
| --- | --- |
| 候选版本 | `0.1.0` 本地安装版，已 Agent 侧门禁通过；待项目所有者完成 OpenAI/DeepSeek/自定义端点真实连接与 10 篇文章页目视验收后切换为"已发布" |
| 检查日期 | 2026-08-24 |
| Git 状态 | TD-2026-019/020 已验证、TD-2026-021 V1.0 收口进行中；workspace 已 commit 至 `9f73bb3`；仍未打 tag、未创建 GitHub Release |
| 环境 | Node.js `v24.14.0`；Chrome for Testing `151.0.7922.34`；darwin-arm64 |
| 候选包 | `.output/textduet-0.1.0-chrome.zip`，333.39 kB |
| 验证矩阵 | `npm run release:check` 通过：typecheck ✓ / 20 个测试文件 / 135 项单元测试 ✓ / 生产构建 ✓ / ZIP 打包 ✓ / `verify-release.mjs` 安全门禁 ✓ |
| 关键安全扫描 | 源码与 `.output/chrome-mv3` 中 `Authorization: Bearer` 仅出现在 `src/providers/openai-compatible.ts` 与 `src/providers/provider-balance.ts` 的 Provider 类内（向用户配置 API 发送的预期用途）；未发现真实 Key 模式（`sk-…` / `gsk_…`）、未发现内容脚本或 console 输出泄漏、未发现构建产物中的用户绝对路径 |
| 候选与正式发布差距 | TD-2026-021 §"项目所有者侧"三项（OpenAI/DeepSeek/自定义真实连接、10 篇文章页目视验收、ZIP 解压加载确认）未执行 |

`npm ci` 与 `npm run release:check` 通过，20 个测试文件、135 项测试通过。候选 ZIP 解压后在临时全新 Chrome 配置中加载成功；6 份原创语料、1000 节点性能、Service Worker 恢复、恶意输出纯文本、60 天用量图、DeepSeek Mock 余额、bfcache 端口断连、动态语言对、划词快捷入口稳定性、header/navigation/footer 召回与本机 icon 视觉回归通过。

公开网站整轮先得到 12/16 通过、0 个产品失败、4 个 GitHub 网络环境失败；独立网络探测恢复后只复跑 4 个失败样本并全部通过。因此同一候选包的 16 个默认目标均取得通过结果，首次网络波动仍如实保留在 TD-2026-013 记录中。

项目所有者已在本机 Chrome 使用 Qwen 配置完成首版真实使用验收，确认首版可正常使用。今后每个版本的打包、加载和人工验收均由项目所有者执行；该职责边界不改变当前“未发布”状态。

## 非阻塞后续

- 项目所有者可在模型厂商控制台核对真实金额和按量账单；当前仅证明 Provider 返回 usage 与本地账本一致。
- 真实 DeepSeek 账户余额未在本轮查询，自动化只使用确定性 Mock，避免读取或截图真实账户数据。
- `0.1.0` 仍未创建 Git tag、GitHub Release、Chrome Web Store 商店发布物；按 `AGENT_DEV.md §5`，tag、push、Release 必须由项目所有者单独授权，Agent 不得代为执行。
