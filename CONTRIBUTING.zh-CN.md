# 参与贡献 TextDuet

[English](./CONTRIBUTING.md)

感谢你帮助改进 TextDuet。这是一个本地优先的 Chrome 扩展；任何改动都必须保持 API Key 信任边界、最小权限、用户对 Provider 费用的控制，以及安全的网页文本渲染。

## 开始之前

- 问题和早期想法请先在 [GitHub Discussions](https://github.com/frealcat/TextDuet/discussions) 讨论。
- 创建新 Issue 前先搜索已有讨论；可复现 Bug、文档修正、功能建议和网站兼容问题请使用相应表单。
- 阅读 [CODE_OF_CONDUCT.zh-CN.md](./CODE_OF_CONDUCT.zh-CN.md)、[SECURITY.zh-CN.md](./SECURITY.zh-CN.md) 和公开的[隐私政策](https://frealcat.github.io/TextDuet/zh-CN/privacy/)。
- 安全漏洞不得公开提交 Issue，请按 `SECURITY.zh-CN.md` 报告。

内部规划材料只作为可选背景，不是贡献前置条件。涉及实现时，维护者会视需要指向相关架构和设计资料。

## 开发环境

要求：Node.js 22 LTS 或更高版本、npm、当前稳定版 Chrome。

```bash
git clone https://github.com/frealcat/TextDuet.git
cd TextDuet
npm ci
npm run typecheck
npm test
npm run build
```

在 `chrome://extensions` 开启开发者模式后，加载 `.output/chrome-mv3`。浏览器验收、发布门禁和本地 Provider 规则请见[开发文档](./docs/DEVELOPMENT.zh-CN.md)。

不得在源码、测试夹具、截图、Issue、Pull Request、构建产物或提交信息中放入 API Key。仅在用户自行执行本地验收时，才可在被 Git 忽略的 `.env.local` 中使用真实值；常规测试必须使用 Mock，且不得产生模型服务商费用。

## Pull Request

每个 Pull Request 应保持单一目标，并说明：

1. 用户问题与影响范围。
2. 实现思路和行为变化。
3. 运行过的测试及结果。
4. 权限、隐私、API Key、Provider 费用、存储或迁移影响。
5. 面向用户的变化所需文档、截图或发布说明更新。

行为变更需要对应的聚焦测试。不得为了通过测试而放宽输入校验、内容脚本边界、可选 Origin 权限或纯文本渲染。新增运行时依赖、Manifest 权限、数据收集、Provider 协议或破坏性数据迁移，必须在实施前取得维护者认可。

## 文档与兼容性报告

修改用户可见行为时，请同步保持英文与中文公开文档一致。不得加入私密 URL、账号数据、不可公开的网页正文、Provider 请求体、API Key 或敏感截图。

网站兼容工作只使用无需登录的公开页面。不得绕过付费墙、验证码、访问控制、robots 限制或网站安全措施。

## 贡献许可

TextDuet 采用 Apache-2.0 许可证。不要求 Contributor License Agreement（CLA）或 Developer Certificate of Origin（DCO）。

提交贡献即表示你确认自己有权提交，并同意该贡献按照 [Apache License 2.0](./LICENSE)（含专利授权）以与项目相同的条款许可。

## 评审与沟通

项目的决策与评审流程见 [GOVERNANCE.zh-CN.md](./GOVERNANCE.zh-CN.md)。维护者可能会要求补充测试、文档、拆分提交或澄清设计后再合并。请保持尊重，并以善意理解讨论。
