# Chrome 权限说明

[English](./CHROME-PERMISSIONS.md)

> 适用于 `0.2.0` 生产 Manifest V3 构建。每次发布前都应检查生成的 `.output/chrome-mv3/manifest.json`。

TextDuet 只申请用户主动翻译所需的最小权限。安装时不会注册常驻内容脚本，也不会请求所有网站的访问权限。

| 权限 | 用途 | 触发时机 |
| --- | --- | --- |
| `activeTab` | 临时读取和操作用户选择的标签页。 | 用户启动整页或选区翻译。 |
| `scripting` | 按需注入扩展内置的 Translator Script。 | 用户在支持的普通网页上主动操作后。 |
| `storage` | 保存非敏感设置、会话状态、加密保险箱元数据和本地控制数据。 | 用户配置或使用 TextDuet 时。 |
| `contextMenus` | 在 Chrome 右键菜单提供“翻译选中文本”。 | 用户右键点击文本选区。 |
| 可选 `https://*/*` | 为配置的 HTTPS 模型 API Origin 提供可请求范围。 | 用户保存 Provider 后，由 Chrome 单独显示授权提示。 |

## Provider Origin 可选访问

`https://*/*` 只是可选声明，不代表安装时获得所有 HTTPS 网站权限。发起 Provider 请求前，TextDuet 会把配置的 Base URL 归一化为单个 HTTPS Origin（例如 `https://api.example.com/*`），再向 Chrome 请求该 Origin。拒绝授权会阻止请求，不会扩大为更宽权限。

该权限用于模型端点，不用于读取任意网站。网页访问仍由 `activeTab` 和用户操作分别控制。更换 Provider Origin 时，Chrome 可能再次显示授权提示；用户可在 Chrome 扩展设置中撤销权限。

选择 OpenRouter 时，公开模型价格请求复用已授权的 `https://openrouter.ai/*` Origin，调用 `/api/v1/models`，不携带 API Key、网页正文、模型名或用量历史。DeepSeek 余额请求仅在用户点击后发送到隐私政策中说明的官方 Origin。

## 不会请求的权限

生产 Manifest 不得包含：

- 在所有网站运行的静态 `content_scripts`；
- 静态 `host_permissions` 或 `<all_urls>`；
- 安装时读取全部浏览活动的权限；
- 远程脚本、远程可执行代码或服务端中转代理。

Translator Script 随扩展打包，仅在用户启动操作后注入。它不能读取 Chrome Storage 或 API Key。

## 支持的页面边界

TextDuet 面向普通 HTTP 和 HTTPS 网页。`chrome://` 等 Chrome 内部页面、Chrome Web Store、扩展页面、受保护的浏览器界面、登录墙、验证码和付费墙不在支持范围。TextDuet 不绕过访问控制，也不会在 Chrome 拒绝脚本注入的页面强行运行。

在支持页面内，提取器会排除隐藏内容、脚本、样式、代码、表单、可编辑字段、按钮和其他交互控件。具有阅读意义的可见链接和导航文本可能进入候选。详见[兼容性说明](./COMPATIBILITY.zh-CN.md)。

## 发布复核

运行 `npm run release:check`，然后检查生成 Manifest：

```bash
sed -n '1,240p' .output/chrome-mv3/manifest.json
rg -n 'content_scripts|<all_urls>|permissions|host_permissions|optional_host_permissions' \
  .output/chrome-mv3/manifest.json
```

任何权限或数据范围变化，都必须先同步运行时契约、架构、隐私政策、本文和迭代记录，并完成维护者隐私审查。源码配置正确不等于构建产物可以发布。
