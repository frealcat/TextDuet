# Chrome 权限说明

> 对应 `0.1.0 Alpha` 生产 Manifest，更新于 2026-08-19。

TextDuet 使用 Chrome Manifest V3。生产构建不注册静态全站内容脚本，也不在安装时申请所有网站的读取权限。

| 权限 | 用途 | 触发方式 |
| --- | --- | --- |
| `activeTab` | 只在用户点击扩展后识别并操作当前标签页 | 用户主动启动翻译 |
| `scripting` | 把 Translator Script 按需注入当前普通网页 | 用户主动启动翻译 |
| `storage` | 在扩展本地保存设置、会话/持久 Key 选择和必要状态 | 用户保存设置或使用功能 |
| `contextMenus` | 在用户选中文本后提供“翻译选中文本”菜单项 | 用户右键选区；只处理 Chrome 提供的当前选区 |
| 可选 `https://*/*` | 只授权用户配置的 HTTPS 模型 API Origin 发起请求 | 保存 Provider 时由 Chrome 单独询问 |

`https://*/*` 是可选权限声明的范围，不代表安装后已获全站访问。实现会把用户填写的 API Base URL 收敛为单个 Origin，例如 `https://api.example.com/*`，再调用 Chrome 的权限请求界面。拒绝后不会发送模型请求。

当已配置 Provider 为 OpenRouter 时，官方模型价格查询复用用户已授予的 `https://openrouter.ai/*` Origin，仅请求公开 `/api/v1/models`，不增加 Manifest 权限，也不携带 API Key、模型名称或本地用量。

网页翻译只支持普通 HTTP/HTTPS 页面。`chrome://`、Chrome Web Store、受保护的浏览器页面、登录墙、验证码和付费墙不在支持范围，也不会尝试绕过访问控制。

发布前运行 `npm run release:check`；门禁会拒绝生产 Manifest 中新增的静态 `host_permissions`、静态 `content_scripts` 或未经文档同步的权限变化。任何新增权限必须先更新 PRD、架构、本文和迭代记录，并完成人工隐私审查。
