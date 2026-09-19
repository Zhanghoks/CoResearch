# CoResearch 设计

| 文档 | 回答什么 | 地位 |
|---|---|---|
| [research-flow.md](./research-flow.md) | 用户怎么从兴趣走到 Idea？Agent / 用户 / Canvas 各做什么？ | 产品流程真值 |
| [idea-formation/](./idea-formation/README.md) | 每一步的输入、输出、Gate、revision | 实现契约；与 Flow 冲突时以 Flow 为准 |
| [canvas/research-canvas.md](./canvas/research-canvas.md) | 画布怎么存、怎么命令、怎么和领域服务分工 | 画布架构；**存储/传输/Agent 工具部分已被 SaaS 架构地图取代**，文中 Superseded 标注 |
| [canvas/huabu-domain-binding.md](./canvas/huabu-domain-binding.md) | 研究对象怎么绑到 Node / Frame / Edge | 画布领域映射；术语已对齐 `canvasId`/内置 Agent |
| [canvas/huabu-node-presentation-and-links.md](./canvas/huabu-node-presentation-and-links.md) | 节点怎么展示、怎么连 | 画布呈现 |
| [canvas/huabu-reverse-engineering.md](./canvas/huabu-reverse-engineering.md) | 从 Huabu 源码借什么、砍什么 | 实现依据；命令集结论已更新为 9 条（[ADR 0010](../adr/0010-restore-structured-frame-layout.md)） |
| [workspace.md](./workspace.md) | `research/` 里存什么，和能力源码怎么隔离 | 落盘；**目录结构已被 Postgres 架构取代**，实体/关系建模思路仍成立，文中 Superseded 标注 |
| [space.md](./space.md) | Wiki 与 Idea 定位空间 | 知识与想法空间（与画布运行时边界"Canvas"是两个不同概念） |
| [idea-structure.md](./idea-structure.md) | Idea 身份、十维、Proposal、确认 | 对象模型；`Proposal` 定义被 [ADR 0004](../adr/0004-candidate-vs-proposal-two-track-model.md) 直接复用 |
| [assets/](./assets/) | 文献空间概念图 | 视觉参考 |

架构层面的当前真值：[CONTEXT.md](../../CONTEXT.md)、决策地图 [`.scratch/coresearch-saas-architecture/map.md`](../../.scratch/coresearch-saas-architecture/map.md)、[docs/adr/](../adr/)。

阅读顺序：[docs/README.md](../README.md)。
