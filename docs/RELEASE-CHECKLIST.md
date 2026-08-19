# Alpha 本地安装候选验收清单

TextDuet 首版只交付可本地加载的 Chrome 扩展包。以下清单用于生成和验收候选包，不包含 Chrome Web Store、其他商店、自动更新、Git tag 或远端推送。

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
| 候选版本 | `0.1.0 Alpha`，本地安装候选已验证、未发布 |
| 检查日期 | 2026-08-18 |
| Git 状态 | TD-2026-017 已形成开发检查点并首次推送；本轮工作区收口后另行提交，仍未 tag、未创建 Release |
| 环境 | Node.js `v24.14.0`；Chrome for Testing `151.0.7922.34`；darwin-arm64 |
| 候选包 | `.output/textduet-0.1.0-chrome.zip`，325.78 kB |
| SHA-256 | `2e46b1f318eab413627ad95feb9342bd871aa6ccafe42aeb4ad5ac3468e1b6fb` |
| 项目所有者实机验收 | 2026-08-18；本机 Chrome；Qwen；正常使用通过 |

`npm ci` 与 `npm run release:check` 通过，15 个测试文件、91 项测试通过。候选 ZIP 解压后在临时全新 Chrome 配置中加载成功；6 份原创语料、1000 节点性能、Service Worker 恢复、恶意输出纯文本、60 天用量图和 DeepSeek Mock 余额链路通过。

公开网站整轮先得到 12/16 通过、0 个产品失败、4 个 GitHub 网络环境失败；独立网络探测恢复后只复跑 4 个失败样本并全部通过。因此同一候选包的 16 个默认目标均取得通过结果，首次网络波动仍如实保留在 TD-2026-013 记录中。

项目所有者已在本机 Chrome 使用 Qwen 配置完成首版真实使用验收，确认首版可正常使用。今后每个版本的打包、加载和人工验收均由项目所有者执行；该职责边界不改变当前“未发布”状态。

## 非阻塞后续

- 项目所有者可在模型厂商控制台核对真实金额和按量账单；当前仅证明 Provider 返回 usage 与本地账本一致。
- 真实 DeepSeek 账户余额未在本轮查询，自动化只使用确定性 Mock，避免读取或截图真实账户数据。
- 本清单最初执行时 commit、tag、push、GitHub Release、商店提交和其他对外分发均未执行；之后项目所有者已授权 TD-2026-017 开发检查点 commit 和首次推送，但仍未创建 tag、GitHub Release 或商店发布物。
