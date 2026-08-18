# 开发者安装与本地试用

## 环境

- Node.js 22 或更高版本
- npm
- 当前稳定版 Google Chrome

## 安装与检查

```bash
npm ci
npm run typecheck
npm test
npm run build
```

在 `chrome://extensions` 开启开发者模式，点击“加载已解压的扩展程序”，选择 `.output/chrome-mv3`。代码更新后重新执行 `npm run build` 并在扩展管理页点击刷新。

需要在另一台机器试用时，执行 `npm run release:check` 获取 `.output/textduet-0.1.0-chrome.zip`。先解压 ZIP，再在 Chrome 中选择解压后、包含 `manifest.json` 的目录；Chrome 不能直接加载 ZIP。首版不提供 Chrome Web Store 或其他商店安装方式，也不包含自动更新。

打开扩展设置页，选择或填写 HTTPS API Base URL、模型名称和 API Key。推荐先使用“仅当前会话保存”，点击“测试连接”确认配置，再到一个无需登录的公开英文文章页启动翻译。真实模型调用可能收费。

本地开发使用：

```bash
npm run dev
```

真实 Provider 验收变量只允许写入被 Git 忽略的 `.env.local`，变量名见 `.env.example`。常规单元测试与公开网站矩阵不得读取真实 Key。

浏览器验收脚本：

```bash
npm run test:browser:options
npm run test:browser:corpus
npm run test:browser:billing
npm run test:browser:sites
```

所有浏览器脚本都需要通过环境变量提供 Playwright 入口、Chrome 可执行文件和构建目录。`test:browser:options` 使用生产页面资产与本地脱敏 runtime mock 验证桌面/窄屏布局、标签输入和分模型图表，不加载真实 Key；其余脚本加载生产扩展，公开网站与语料回归使用 Mock Provider。

## 本地安装候选检查

```bash
npm run release:check
```

该命令依次执行类型检查、单元测试、生产构建、Chrome ZIP 打包和候选包安全检查。产物位于 `.output/`，不进入 Git。完整人工步骤见[本地安装候选验收清单](./RELEASE-CHECKLIST.md)。
