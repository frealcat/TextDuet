# TextDuet 开源许可证说明

> 这是一份面向项目决策的工程说明，不构成法律意见。正式发布或商业化前如有特殊风险，应咨询专业律师并阅读许可证原文。

## 已确认决策

TextDuet 自 2026-08-14 起采用 **Apache License 2.0（Apache-2.0）**。根目录 `LICENSE` 保存完整许可证文本，所有贡献默认按同一许可证提交。

选择它的原因：

- 允许个人和企业自由使用、修改、分发及商业化，适合扩展生态传播。
- 对贡献相关的专利授权和专利诉讼终止机制有明确约定。
- 相比 Copyleft 许可证，集成到其他开源或闭源产品的阻力较低。
- 分发者需要保留许可证和相关声明，并标明其修改；若项目提供 `NOTICE`，分发时还需要按许可证要求处理其中的归属声明。

需要接受的取舍：第三方可以发布闭源修改版，Apache-2.0 不要求其公开对 TextDuet 的改进。

## MIT、Apache-2.0 与 MPL-2.0 的核心区别

| 维度 | MIT | Apache-2.0 | MPL-2.0 |
| --- | --- | --- | --- |
| 类型 | 宽松许可证 | 宽松许可证 | 文件级弱 Copyleft |
| 商业使用 | 允许 | 允许 | 允许 |
| 闭源发布修改版 | 允许 | 允许 | 修改过的 MPL 文件需继续提供源码；独立新文件可以闭源 |
| 主要保留义务 | 保留版权和许可声明 | 保留许可证、标明修改，并处理适用的 NOTICE | 提供被覆盖文件及修改的源码和许可通知 |
| 明确专利授权 | 无专门条款 | 有 | 有 |
| 合规复杂度 | 最低 | 中等 | 中等 |

简单说：MIT 最短；Apache-2.0 保持宽松同时把专利与分发义务写得更清楚；MPL-2.0 则要求被修改的 MPL 文件保持开源。

## 项目应用方式

1. 根目录 `LICENSE` 使用未经删改的 Apache-2.0 完整文本。
2. 根目录 `NOTICE` 保存项目归属声明；分发版本需要一并保留适用内容。
3. README、PRD、贡献指南和发布材料统一标注 `Apache-2.0`。
4. 引入第三方代码或资产时，必须核对其许可证兼容性并保留所需归属信息。
5. 若修改来自第三方的 Apache-2.0 文件，应按许可证要求保留原有通知并显著标明修改。
6. 发布物同时保留 `THIRD_PARTY_NOTICES.md` 中适用的第三方版权与许可证声明。
7. 用量图表按需引入 Apache ECharts（Apache-2.0）；其 zrender（BSD-3-Clause）与 tslib（0BSD）运行时归属一并记录在第三方声明中。

## 原始材料

- MIT：<https://opensource.org/license/mit>
- Apache-2.0：<https://www.apache.org/licenses/LICENSE-2.0>
- Apache 许可证应用说明：<https://www.apache.org/legal/apply-license>
- MPL-2.0：<https://www.mozilla.org/MPL/2.0/>
- MPL-2.0 FAQ：<https://www.mozilla.org/MPL/2.0/FAQ/>
