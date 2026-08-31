# 常见问题

[English](./FAQ.md)

## TextDuet 免费吗？

TextDuet 不收取插件订阅费。你的模型 Provider 可能会收取 API 使用费，其账单、限流、数据留存和条款不受 TextDuet 控制。

## TextDuet 会看到我的 API Key 或翻译网页吗？

TextDuet 不运营项目方的翻译中转服务器。用户启动翻译后，符合规则的网页文本会直接发送给你选择的 Provider。API Key 不会发送到网页或 Translator Script。详情见[隐私政策](https://frealcat.github.io/TextDuet/zh-CN/privacy/)。

## 会话模式和保险箱有什么区别？

会话模式仅在当前 Chrome 会话中保存 API Key，浏览器重启后会清除。本地保险箱用你输入的密码加密保存本地模式 Key 与持久译文缓存；密码本身不会保存，重启后保险箱会锁定，需重新解锁。

## 为什么持久译文缓存不可用？

持久缓存属于本地保险箱。保险箱锁定、重启后尚未解锁，或你清空/删除它时，持久缓存均不可用。当前页面仍可复用仅保存在该页面会话内存中的译文。

## 为什么 Chrome 要求 Provider 权限？

TextDuet 会请求你配置 API 端点所对应的具体 HTTPS Origin，以便调用该 Provider；它不会获得对所有网站的永久访问权限。参见 [Chrome 权限](./CHROME-PERMISSIONS.zh-CN.md)。

## 所有网页都能翻译吗？

不能。Chrome 和网站可能限制扩展注入。TextDuet 不绕过访问控制，并会刻意排除表单、按钮、代码、隐藏内容和其他交互区域。参见[兼容性说明](./COMPATIBILITY.zh-CN.md)。

## GitHub Release ZIP 如何安装？

先解压，再在 `chrome://extensions` 开启开发者模式并加载包含 `manifest.json` 的目录。Chrome 不能直接加载 ZIP。GitHub 手动加载版需要手动更新。参见[安装说明](./INSTALLATION.zh-CN.md)。

## 到哪里寻求帮助或报告 Bug？

帮助与想法请使用 [GitHub Discussions](https://github.com/frealcat/TextDuet/discussions)，可复现 Bug 与公开网站兼容问题请使用 Issue 表单。不要提交秘密或敏感页面。安全报告请走[私密渠道](../SECURITY.zh-CN.md)。
