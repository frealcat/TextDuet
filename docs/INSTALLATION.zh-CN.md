# 安装与更新 TextDuet

[English](./INSTALLATION.md)

TextDuet `0.2.0` 计划通过三种渠道分发。商店条目公开后，普通使用推荐
Chrome Web Store；GitHub Release 和源码构建主要面向高级用户、测试者和贡献者。

## 1. Chrome Web Store

`0.2.0` 商店条目公开后，请从 Chrome Web Store 安装 TextDuet，并保持自动更新开启。只有商店渠道提供由 Chrome 管理的自动更新。

安装后：

1. 如有需要，可从 Chrome 扩展菜单将 TextDuet 固定到工具栏。
2. 打开 TextDuet Options。
3. 选择 Provider，填写 HTTPS API 端点与模型，然后添加 API Key。
4. 临时使用请选“仅当前会话”；若需要加密的本机持久化，请创建或解锁本地保险箱。
5. 测试连接后，先从短小的公开网页开始。

TextDuet 不提供模型额度，模型服务商可能对请求收费。

## 2. GitHub Release ZIP

从 [GitHub Releases](https://github.com/frealcat/TextDuet/releases) 下载对应的 `textduet-<version>-chrome.zip` 和 `SHA256SUMS.txt`。条件允许时，请先校验文件摘要。

1. 解压 ZIP。Chrome 不能直接加载 ZIP 文件。
2. 打开 `chrome://extensions`。
3. 开启“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择包含 `manifest.json` 的解压后目录。

手动加载版需手动更新：下载下一版、解压至新目录，在 `chrome://extensions` 中重新加载或替换扩展，然后重新打开 Options。确认新版本可用前，请保留旧的解压目录。

## 3. 从源码构建

要求：Node.js 22 LTS 或更高版本、npm、稳定版 Chrome。

```bash
git clone https://github.com/frealcat/TextDuet.git
cd TextDuet
npm ci
npm run build
```

在 `chrome://extensions` 中通过“加载已解压的扩展程序”加载 `.output/chrome-mv3`。完整本地门禁：

```bash
npm run release:check
```

生成的 `.output/` 是本机构建产物，不是发布事实来源。修改或验证项目时，请遵循[开发文档](./DEVELOPMENT.zh-CN.md)。

## 存储与迁移边界

- Chrome Web Store、手动加载的 Release ZIP 和本地源码构建可能使用不同的扩展 ID，并拥有彼此独立的 Chrome 存储空间。
- 不要期待 API Key、保险箱材料、译文缓存、预算设置或用量历史会在不同安装方式之间自动迁移。
- 仅会话 Key 会在 Chrome 重启后清除。
- 本地保险箱会加密保存本地模式 Key 与持久译文缓存，密码本身不会保存；Chrome 重启后需再次解锁才能使用这些加密记录。
- 删除旧安装前，请确认新安装可用。除非未来版本明确提供迁移流程，否则任何本地存储转移均不受支持。

## 更新与回退

- **商店版：** Chrome 自动更新扩展。若更新涉及本地数据格式，请在打开 Options 前阅读 Release Notes。
- **手动 ZIP 或源码构建：** 加载新版本前保留已知可用的解压目录。需要回退时重新加载旧目录；这并不保证跨版本数据兼容。
- 不要手动复制浏览器扩展存储目录或保险箱记录。这可能破坏加密、数据完整性或扩展 ID 边界。

## 获取帮助

安装问题请前往 [GitHub Discussions](https://github.com/frealcat/TextDuet/discussions)。可复现问题请使用 Issue 表单，并先删除 API Key、密码、私密 URL、账号信息和敏感网页内容。参见[支持](../SUPPORT.zh-CN.md)和[常见问题](./FAQ.zh-CN.md)。
