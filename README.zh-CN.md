# TextDuet

> Your key. Two languages. One page.

[English](./README.md) | [许可证](./LICENSE) | [隐私政策](https://frealcat.github.io/TextDuet/zh-CN/privacy/) | [支持](./SUPPORT.zh-CN.md) | [安全](./SECURITY.zh-CN.md)

TextDuet 是一款本地优先、开源的 Chrome 双语网页阅读扩展。你自行选择 OpenAI 兼容模型服务商、填写自己的 API Key，并从扩展中主动启动翻译。网页文本会从 Chrome 直接发送至你选择的服务商；TextDuet 不运营翻译中转服务器，也不提供账号服务。

**发布状态：** TextDuet `0.2.0` 正在准备首次公开发布。Chrome Web Store 链接和对应的 GitHub Release 会在审核与发布门禁完成后补充。请不要把源码检出或尚未发布的构建当作正式版本。

## 能力概览

- 翻译当前标签页中由用户触发、可见且符合规则的阅读文本，并支持双语、仅原文、仅译文三种阅读模式。
- 支持 OpenAI 兼容 API，以及 OpenAI、Qwen、DeepSeek、OpenRouter、硅基流动预设和自定义 HTTPS 端点。
- 模型配置与用量数据保存在扩展本地；API Key 只在可信扩展上下文中处理，绝不插入网页。
- 仅在用户配置服务商时按需申请对应 HTTPS Origin 访问权限；不注册常驻内容脚本，也不在安装时获取全站网页访问权限。
- 提供译文缓存控制、本地 Token 用量记录、预算提醒、选区翻译和仅本地导出的兼容性诊断。

TextDuet 不收取插件订阅费，但模型服务商可能会对 API 请求收费。翻译敏感内容前，请先阅读所选服务商的条款、价格和数据处理政策。

## 安装与更新

| 渠道 | 面向用户 | 安装与更新 | 支持边界 |
| --- | --- | --- | --- |
| Chrome Web Store | 大多数用户 | 商店安装与自动更新 | 推荐的正式支持渠道 |
| [GitHub Releases](https://github.com/frealcat/TextDuet/releases) | 高级用户和测试者 | 下载版本 ZIP、解压后在 `chrome://extensions` 加载已解压目录；更新需手动完成 | 尽力支持；Chrome 不能直接加载 ZIP |
| 源码构建 | 贡献者和开发者 | 从源码构建并加载 `.output/chrome-mv3` | 用于开发与排错 |

商店安装与手动加载的扩展可能拥有不同的扩展 ID 和独立 Chrome 存储空间。不要假设 API Key、本地缓存或用量记录会在两者之间自动迁移。

完整安装与更新说明：[中文](./docs/INSTALLATION.zh-CN.md) | [English](./docs/INSTALLATION.md)

### 从源码构建

环境要求：Node.js 22 LTS 或更高版本、npm、当前稳定版 Chrome。

```bash
npm ci
npm run typecheck
npm test
npm run build
```

打开 `chrome://extensions`，开启“开发者模式”，点击“加载已解压的扩展程序”，选择 `.output/chrome-mv3`。修改代码后需要重新构建，并在 Chrome 扩展管理页点击重新加载。

生成候选包并执行本地门禁：

```bash
npm run release:check
```

该命令会创建 `.output/textduet-<version>-chrome.zip`。必须先解压 ZIP，才能在 Chrome 中加载。测试命令、浏览器要求和本地 Provider 安全约束见[开发文档](./docs/DEVELOPMENT.zh-CN.md)。

## 隐私与安全

- 翻译只在用户主动启动后发生。符合规则的可见阅读文本会直接发送到你配置的模型服务商，不会经过 TextDuet 服务器。
- TextDuet 不包含账号、遥测、广告、云同步或自动问题上传。
- API Key、密码、认证头和网页正文不会写入 Issue 模板、诊断包或仓库示例。
- `0.2.0` 支持仅会话 Key 与密码解锁的本地**保险箱**。会话 Key 会在 Chrome 重启后清除。本地模式下的 Key 与持久译文缓存以 AES-GCM 密文形式保存；密码本身不会保存，浏览器重启后保险箱会处于锁定状态，需用户重新解锁。锁定期间，持久缓存不可用，但当前页面仍可复用内存中的译文。
- 模型输出被视为不可信文本，只按文本渲染，不作为 HTML 或可执行代码处理。

安装前请阅读完整说明：[隐私政策](https://frealcat.github.io/TextDuet/zh-CN/privacy/) | [Privacy Policy](https://frealcat.github.io/TextDuet/privacy/) | [Chrome 权限](./docs/CHROME-PERMISSIONS.zh-CN.md)。

发现安全漏洞时，**不要**公开提交 Issue。请使用 [GitHub 私密漏洞报告](https://github.com/frealcat/TextDuet/security/advisories/new)，或发送邮件至 [frealcat@gmail.com](mailto:frealcat@gmail.com)。详见 [SECURITY.zh-CN.md](./SECURITY.zh-CN.md)。

## 文档

| 主题 | 中文 | English |
| --- | --- | --- |
| 安装与更新 | [安装与更新](./docs/INSTALLATION.zh-CN.md) | [Installation](./docs/INSTALLATION.md) |
| 开发与本地构建 | [开发](./docs/DEVELOPMENT.zh-CN.md) | [Development](./docs/DEVELOPMENT.md) |
| 隐私政策 | [隐私](https://frealcat.github.io/TextDuet/zh-CN/privacy/) | [Privacy](https://frealcat.github.io/TextDuet/privacy/) |
| 权限 | [Chrome 权限](./docs/CHROME-PERMISSIONS.zh-CN.md) | [Chrome permissions](./docs/CHROME-PERMISSIONS.md) |
| 兼容性 | [兼容性](./docs/COMPATIBILITY.zh-CN.md) | [Compatibility](./docs/COMPATIBILITY.md) |
| 常见问题 | [常见问题](./docs/FAQ.zh-CN.md) | [FAQ](./docs/FAQ.md) |
| 0.2.0 发布说明 | [发布说明](./docs/RELEASE-NOTES-0.2.0.zh-CN.md) | [Release notes](./docs/RELEASE-NOTES-0.2.0.md) |
| 参与贡献 | [贡献指南](./CONTRIBUTING.zh-CN.md) | [Contributing](./CONTRIBUTING.md) |
| 社区治理 | [治理规则](./GOVERNANCE.zh-CN.md) | [Governance](./GOVERNANCE.md) |

以上公开文档已足够用于安装、评估、构建和参与 TextDuet。

## 获取帮助与参与贡献

安装、Provider、费用和想法讨论请前往 [GitHub Discussions](https://github.com/frealcat/TextDuet/discussions)。可复现 Bug、文档修正、功能建议和网站兼容问题请使用对应 Issue 表单。请勿提交 API Key、私密 URL、账号信息、未公开文本或包含敏感信息的截图。

欢迎贡献。请阅读 [CONTRIBUTING.zh-CN.md](./CONTRIBUTING.zh-CN.md)、[CODE_OF_CONDUCT.zh-CN.md](./CODE_OF_CONDUCT.zh-CN.md) 和 [GOVERNANCE.zh-CN.md](./GOVERNANCE.zh-CN.md)。项目不要求 CLA 或 DCO；提交贡献即表示你同意以 Apache-2.0 许可该贡献，并确认自己有权这样做。

## 许可证

TextDuet 采用 [Apache License 2.0](./LICENSE)。重新分发时，请一并保留 [NOTICE](./NOTICE) 和[第三方声明](./THIRD_PARTY_NOTICES.md)。
