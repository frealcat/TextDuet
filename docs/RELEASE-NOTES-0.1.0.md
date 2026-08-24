# TextDuet 0.1.0 Release Notes

> 发布日期：2026-08-24
>
> 适用安装包：`.output/textduet-0.1.0-chrome.zip`（336.21 kB，SHA-256 `d6b8b8feb7313b855a62aab090168bbfd157ce8d171ed2c2795d8ab98cf396df`）
>
> 安装方式：Chrome 开发者模式本地加载，**不**通过 Chrome Web Store 或其他商店分发
>
> 许可证：Apache-2.0
>
> 配套 Git tag：`0.1.0`（待项目所有者按 `AGENT_DEV.md §5` 单独授权后创建）

## 概述

TextDuet 是一款本地优先、用户自带模型 API 的 Chrome 双语网页翻译扩展。0.1.0 是首个"已验证"的本地安装版，覆盖完整翻译主链路、成本透明、缓存、本地诊断、选区翻译与公开页面兼容性。

核心价值：**Your key. Two languages. One page.** —— 用自己的 Key、自己的模型，在普通网页上同时阅读原文与译文。

## 功能清单

### 网页翻译主链路

- 阿里云百炼 Qwen / OpenAI / DeepSeek / OpenRouter / 硅基流动 预设；自定义兼容 HTTPS 端点
- 当前网页已加载正文逐段翻译；首屏出现后增量监听滚动加载的新内容；停止后断开监听
- 双语 / 仅原文 / 仅译文三种显示模式
- OpenAI-compatible SSE 流式响应；普通 JSON 同响应回退；批次完成事件整批幂等回显
- 选区翻译：右键菜单 + 可选的"选中后边角图标"（默认关闭）
- 翻译前 token / 费用区间预估；批次大小按内容长度自适应

### 成本与每日预算

- 翻译前 token / 费用预估；写入本地账本只取 Provider 响应实际 usage
- 最近 60 天输入 / 输出 token 折线图，按模型拆分每日序列和汇总
- 50% / 80% / 100% 本地每日预算提醒
- OpenRouter 官方 `/api/v1/models` 价格匹配；DeepSeek 官方余额查询（结果不持久化）
- 数字价格仅在官方结构化接口可查时展示；其他情况隐藏

### 本地缓存

- 内容寻址的本地译文缓存（30 天、50 MiB、LRU）
- 缓存命中不重复计入模型用量
- 占用摘要 + 手动清理入口

### 模型配置（0.1.1 新增）

- 不同供应商的模型名称独立保存：切换 Provider 预设时不再残留上一个供应商的模型列表
- 老用户的现存 `model` / `models` 在 0.1.1 加载时自动迁移到当前 baseUrl origin 桶；切换供应商后回切仍能恢复各自的模型列表

### Header / footer / nav 壳层兼容（0.1.1 新增）

- 默认候选选择器覆盖 WAI-ARIA 角色 `[role="banner"]` 与 `[role="contentinfo"]`，覆盖不写语义标签的 Gatsby / Next / 自定义 div shell
- `SiteRule` 新增可选 `headerExtras` / `footerExtras` 字段；按 host 显式扩展站点特定选择器
- 继续保留 `<header>` / `<footer>` / `nav` / `[role="navigation"]` 的窄选择器与"按钮 / 代码 / 表单 / 隐藏区 / 侧栏"排除

### Header 内 popup 动态翻译（0.1.1 新增，默认关闭）

- Options 开关「页面顶部菜单的弹出内容也参与翻译」：开启后点击 GitHub / Stack Overflow 等头像菜单、站内搜索建议等头部弹窗内容，自动触发一次局部重扫
- 关闭时与 0.1.0 行为一致（只翻译主文档流）

### 公开页面兼容

- 16 个默认 P0 公开 URL（海外社区 / 框架技术文档 / 创意设计站）
- 6 份原创 HTML 语料 + 1000 节点性能基线（提取中位数 < 5ms）
- Service Worker 恢复、虚拟列表节点复用、原地改写、body 替换场景下均能继续翻译
- 恶意模型输出纯文本渲染

### 兼容性与诊断

- Options 可为最近一次翻译页面生成本地脱敏诊断预览
- 诊断包不自动上传；用户可选择问题类型；明确同意后才包含已去除查询参数与片段的页面路径
- 诊断默认只关联最近一次翻译的标签页

### 端口与稳定性（0.1.0 修复）

- 翻译流式进行中页面进入 bfcache / 导航离开时，`port.postMessage` 抛错被静默并写入本地 `console.warn` 诊断，不再产生 `Unchecked runtime.lastError` 警告

## 安装步骤

1. 解压 `textduet-0.1.0-chrome.zip`（不能直接加载 ZIP）
2. 打开 `chrome://extensions`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择解压后的扩展目录
6. 在扩展 Options 页填入 Provider 端点、模型名称、API Key
7. 推荐"仅当前会话保存" Key；先点"测试连接"确认配置
8. 打开普通 HTTP / HTTPS 文章页，从扩展 Popup 启动翻译

## 已知边界

- 不支持登录墙、验证码、付费墙、`chrome://`、Chrome Web Store、受保护页面；访问保护类只记为环境状态
- OpenAI 真实连接未在本机 Chrome 验收（项目所有者决策）；DeepSeek 与 1 个自定义兼容端点（OpenRouter / 硅基流动二选一）已通过
- 0.1.0 仅 Chrome MV3；不承诺 Edge / Firefox / Safari 兼容
- 0.1.0 仅以本地安装版形式分发；不上 Chrome Web Store、不设自动更新

## 升级与回退

- 从 0.1.0 之前 commit 升级到 0.1.0：直接重新加载解压目录即可；本地账本与缓存跨版本兼容
- 回退到 0.1.0 之前：保留 `.output/chrome-mv3` 副本，在 `chrome://extensions` 移除 0.1.0 后重新加载旧版
- 0.1.1 之后：模型配置会按 baseUrl origin 迁移；老用户的 `model` / `models` 自动归到当前 origin 桶

## 风险与限制

- 模型 API 费用由用户承担；扩展不收取订阅费
- 浏览器扩展本地存储不是 OS 级加密保险箱；持久保存 Key 前请理解风险
- 0.1.0 不会主动发任何网络请求，所有翻译请求由用户点击触发
- 模型输出按不可信数据校验并仅以纯文本渲染；不执行模型返回的 HTML / script / CSS

## 关联文档

- [CHANGELOG.md](../CHANGELOG.md)
- [README.md](../README.md)
- [产品需求文档](./PRD.zh-CN.md)
- [产品迭代路线图](./PRODUCT-ROADMAP.md)
- [产品迭代记录](./ITERATION-LOG.md)（含 TD-2026-021 / 022）
- [Chrome 权限说明](./CHROME-PERMISSIONS.md)
- [隐私政策](./PRIVACY.md)
- [本地安装候选验收清单](./RELEASE-CHECKLIST.md)
- [开发者安装与本地试用](./DEVELOPMENT.md)
