# 开发与本地构建

[English](./DEVELOPMENT.md)

TextDuet 是仅支持 Chrome 的 Manifest V3 扩展，技术栈为 WXT、React、TypeScript strict、Vitest 和 npm。Service Worker 负责 Provider 请求与密钥；按需注入的 Translator Script 只处理网页 DOM，不读取扩展存储。

## 环境要求

- Node.js 22 LTS 或更高版本（如仓库提供 `.nvmrc`，请使用其中版本）。
- npm 和仓库提交的 `package-lock.json`。
- 当前稳定版 Google Chrome，用于本地加载。

## 安装、检查与构建

```bash
npm ci
npm run typecheck
npm test
npm run build
```

加载生成的 `.output/chrome-mv3`：

1. 打开 `chrome://extensions`。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择 `.output/chrome-mv3`。
4. 修改源码后重新执行 `npm run build`，再在扩展管理页重新加载。

完整公开仓库发布门禁（含 ZIP 和产物校验）：

```bash
npm run release:check
```

ZIP 位于 `.output/`，文件名为 `textduet-<package-version>-chrome.zip`。Chrome 必须加载解压目录，不能直接加载 ZIP。构建产物不是源码事实来源，不得提交。

## 开发服务器

迭代 WXT 开发构建时可运行 `npm run dev`。开发服务器产物与发布 ZIP 不同；发布行为应使用 `npm run build` 和生成的 `.output/chrome-mv3` 验证。

## 公开隐私页面

公开隐私页面从已经审阅的英文与简体中文政策源文件生成。本地构建命令：

```bash
npm run pages:build
```

该命令会创建可丢弃的 `.pages/` 目录，其中包含英文
`privacy/index.html`、简体中文 `zh-CN/privacy/index.html` 和一个语言选择首页。政策、页面模板或样式变更后，应在合并前检查生成结果。该命令不会部署 Pages，也不会让公开 URL 自动生效。

只有审阅后的源文件进入 `main`，且维护者在仓库设置中将 Pages 来源启用为 **GitHub Actions** 后，工作流才会部署。在公开使用固定链接前，请在未登录 GitHub 的环境确认两个已部署页面均返回 `200` 且显示当前政策日期。

## 浏览器回归命令

仓库提供 Options UI、合成语料、账单和公开网站兼容性的 Playwright 脚本：

```bash
npm run test:browser:options
npm run test:browser:corpus
npm run test:browser:billing
npm run test:browser:sites
```

CI 和 Release 工作流还会运行本地夹具冒烟测试。要在本地执行同一门禁，先安装锁定的浏览器，并在另一个终端启动夹具服务：

```bash
npx playwright install chromium
node scripts/serve-fixtures.mjs
```

然后使用生产构建目录和 Playwright Chrome 运行冒烟脚本（脚本固定简体中文界面语言，确保控件文案断言稳定）：

```bash
PLAYWRIGHT_ENTRY="$(node --input-type=module -e 'process.stdout.write(await import.meta.resolve("playwright"))')" \
CHROME_EXECUTABLE="$(node --input-type=module -e 'const playwrightModule = await import("playwright"); const { chromium } = playwrightModule.default ?? playwrightModule; process.stdout.write(chromium.executablePath())')" \
EXTENSION_DIR="$PWD/.output/chrome-mv3" \
FIXTURE_URL=http://127.0.0.1:8765/multilingual.html \
npm run test:browser:smoke
```

夹具服务只提供 `tests/fixtures/pages/` 下的项目原创文件，会拒绝路径穿越和非文件路径，不应用来托管任意用户内容。如果 `8765` 端口已被占用，可使用 `TEXTDUET_FIXTURE_PORT=8876 node scripts/serve-fixtures.mjs` 启动，并在 `FIXTURE_URL` 中使用同一端口。冒烟测试使用 Mock Provider 和脚本中的测试专用 Key 字面量。

这些脚本需要本地 Playwright/Chrome 环境及脚本或测试 Harness 中说明的变量。默认使用合成页面、Mock Provider 或本地缓存夹具；不得读取真实 Key 或未经审查地发起付费请求。公开网站可能因网站或网络阻止自动化而失败，应记录为环境结果，不能冒充产品通过或失败。

## 真实 Provider 检查

只有用户控制的本地人工检查可以使用真实 Provider。把值写入被 Git 忽略的 `.env.local`，变量名见 `.env.example`：

```dotenv
TEXTDUET_TEST_API_HOST=api.example.com
TEXTDUET_TEST_API_BASE_URL=https://api.example.com/v1
TEXTDUET_TEST_API_KEY=
TEXTDUET_TEST_MODEL=
```

不得提交 `.env.local`，不得把 Key 粘贴到 Issue/PR，不得放进测试夹具或截图，也不得通过 `VITE_`/`WXT_PUBLIC_` 变量暴露。普通单测和浏览器测试使用 Mock，不应产生模型费用。真实请求可能收费并会把网页文本发送给所选 Provider；请从短小公开页面开始，完成后停止翻译。

## 安全与架构规则

- API Key 只存在可信扩展上下文；公共设置和运行时消息必须脱敏。
- Translator Script 不得导入 Storage 或 Provider 模块。
- 可选 HTTPS Origin 请求必须收敛到配置的 Provider。
- 模型输出按纯文本渲染；禁止 `innerHTML`、`eval` 或远程代码。
- 修改 Provider 响应、DOM 去重、停止/取消或保险箱迁移时，补充畸形输入、重复/注入内容和锁定路径测试。
- Pages 生成器不得引入分析、远程脚本、远程字体或私有/用户特定内容。
- 未经产品和隐私决策，不得新增遥测、中转服务器、账号收集或 Manifest 权限。

参阅[贡献指南](../CONTRIBUTING.zh-CN.md)和[架构说明](./ARCHITECTURE.md)，了解公开的贡献与工程约束。

## 发布准备

发布前运行 `npm run release:check`，完成全新 Chrome 配置验收，并复核生成的 ZIP、SBOM、第三方许可证报告和 SHA-256 文件。发布、打标签、上传和 Chrome Dashboard 设置均由维护者执行；本文不构成授权。
