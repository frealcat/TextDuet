# 贡献指南

感谢参与 TextDuet。开始开发前必须先阅读 [Agent 开发规范](./AGENT_DEV.md)、[PRD](./docs/PRD.zh-CN.md)、[产品迭代路线图](./docs/PRODUCT-ROADMAP.md)与[架构说明](./docs/ARCHITECTURE.md)。

## 开发原则

1. 不把 API Key 或其他机密发送到内容脚本。
2. 不新增远程可执行代码、广告 SDK 或默认遥测。
3. 新增权限必须说明用户价值、触发时机和更小权限的替代方案。
4. 模型返回内容必须作为不可信文本处理，禁止通过 `innerHTML` 注入网页。
5. Provider 特有逻辑放入 `src/providers/`，不要泄漏到界面或内容脚本。
6. 新功能需要对应测试与 PRD/架构文档更新。
7. 贡献默认按 Apache-2.0 许可提交。
8. 产品级迭代必须更新[迭代记录](./docs/ITERATION-LOG.md)；用户可见变化必须写入 [CHANGELOG](./CHANGELOG.md) 的 `Unreleased`。

## 提交流程

```bash
npm install
npm run typecheck
npm test
npm run build
```

建议提交保持单一目的，并在说明中包含：用户问题、实现方式、权限或隐私影响、验证结果。里程碑状态、迭代证据和发布日志应与该提交的实际范围一致；未发布功能不得标记为“已发布”。
