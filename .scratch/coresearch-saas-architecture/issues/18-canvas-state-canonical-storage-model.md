# `canvas_state` 的规范存储形态：整体快照 vs 规范化表

Type: grilling
Status: open

## Question

[ticket 12](12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md)/[ADR 0005](../../../docs/adr/0005-candidate-acceptance-transaction-shape.md) 把 `canvas_state` 的公式更正为"Canvas 原生拓扑（Frame/Note/PDF/Question/Web）+ Research-managed 投影"，但没有回答一个更根本的问题：**Canvas 原生节点的内容和几何，规范存储在哪？**

两个方案没有二选一：

- **方案 A**：`canvas_state`（`{project_id/canvas_id, version, nodes jsonb, edges jsonb}`）本身就是 Canvas 原生拓扑的权威存储——Research-managed 节点是其中一个可以从 `canvas_projections`+`research_entities`+`canvas_layout` 重新拼出来的子集，但 Note/Frame/PDF 这些原生节点的内容只存在 `canvas_state` 这个 JSON 快照里，删了就是真的丢了。
- **方案 B**：`canvas_nodes`/`canvas_edges`/`canvas_layout`/`canvas_projections` 都是规范化的 canonical 表（每种节点类型的内容和几何有自己的行），`canvas_state` 降级成一份完整渲染快照/缓存，可以整体删除重建，不是任何东西的唯一存储位置。

选 B 的理由：CoResearch 已经是 Postgres SaaS，不是 Huabu 那种"文件即状态"的单机应用，把 Canvas 原生内容焊死在一个 JSON blob 里放弃了关系数据库的查询/索引/约束能力（比如没法直接 `WHERE` 出"这个 canvas 上所有 Note 节点"）；也和已经定的"`canvas_state` 是可删可重建的缓存"这条原则更一致——如果 A 成立，那句话就是错的，需要回去改 `CONTEXT.md`。

需要确定：选 A 还是 B；如果选 B，`canvas_nodes` 要不要覆盖 Research-managed 节点（即 `canvas_projections` 是不是 `canvas_nodes` 的一个子类型/外键，而不是平行的表），还是保持 `canvas_projections` 独立、只有原生节点进 `canvas_nodes`。
