# Canvas 规范存储：统一 `canvas_nodes`，Projection 是 binding 不是平行节点体系

- 状态：accepted

[ADR 0005](./0005-candidate-acceptance-transaction-shape.md) 把 `canvas_state` 的公式更正为"Canvas 原生拓扑（Frame/Note/PDF/Question/Web）+ Research-managed 投影"，但没有回答原生节点的内容和几何规范存储在哪。补上这个答案后，`canvas_state`（原来设想的整体 JSON 快照，`{version, nodes jsonb, edges jsonb}`）这个概念本身不再需要——不是"降级成缓存"，是被下面的规范化表直接取代，因为已经没有别的东西可以从它重建了。

**决策**：单张 `canvas_nodes` 表覆盖所有节点类型（原生 + Research-managed），`node_type` 判别式区分 `note`/`frame`/`pdf`/`question`/`web`/`crEntity`，只装身份、拓扑（`parent_node_id` 自引用）和"画布原生 authored 内容"（`native_data`——crEntity 行最多装画布层批注，绝不装语义内容）。`canvas_projections` 是 `canvas_nodes` 的 0..1 binding 表（只有 `crEntity` 行有对应记录，`node_id` 是主键），不是第二套平行的节点清单；不加 `UNIQUE(canvas_id, entity_id)`——同一实体允许被多个节点/多张 canvas 各自投影，不提前锁死"同 canvas 唯一"。几何单独拆一张 `canvas_layout`（`node_id` 主键，x/y/width/height/z_order/pinned/collapsed）——不是为了"缓存重建时存活"（那条理由随 `canvas_state` 一起消失了），是"节点是什么"和"它在哪多大"两个关注点本身值得分开。边分两种：`canvas_edges` 只存纯画布连线（不对应任何 `research_relations`），代表研究关系的边是投影器渲染时从 `research_relations × canvas_projections` 计算的虚拟边，不持久化成行——语义连接的唯一真值源仍然只有 `research_relations`。`canvases.version` 是唯一权威的版本计数器，`canvas_deltas.from/to_version` 与它对齐，不允许出现第二个"版本"字段。

**不变量**（应用层/事务层保证，不是跨表 DB constraint）：一条 `canvas_projections` 记录存在当且仅当对应 `canvas_nodes.node_type = 'crEntity'`——[候选接受事务](./0005-candidate-acceptance-transaction-shape.md) 是保证这条的唯一入口。

理由不是规范化本身更"干净"，是移植自 Huabu 的共享 canvas-engine 的数据模型逼出来的：8 条命令（[ADR 0001 保留的 `executeCanvasCommands`](./0001-hybrid-backend-supabase-as-infra.md)、`CREATE_NODES`/`SET_NODE_PARENT`/`normalizeTreeOrder` 等）对节点类型无感——`@xyflow/react` 的 `Node.type` 只是 `data` payload 形状的判别式，执行器不关心。如果原生节点和 Research-managed 节点分属两张表，引擎的每条命令都要先判断"这条命令的目标在哪张表"，这是在给一个设计上类型无关的执行器强加类型分支，且和"命令集原样移植不重写"（[ticket 01](../../.scratch/coresearch-saas-architecture/issues/01-canvas-engine-command-set.md)）的前提冲突。[Direction Deep Dive 的 Phase Frame 结构](../../.scratch/coresearch-saas-architecture/issues/13-direction-deep-dive-data-model.md) 需要 crEntity 节点能挂在 Frame 节点下面（`SET_NODE_PARENT`），`parent_node_id` 必须是同一张表内的自引用外键，两张平行表会需要处理"父节点可能在表 A 也可能在表 B"的多态外键，没有必要的复杂度。

被拒绝的替代方案：`canvas_state` 作为原生拓扑的权威 JSON 快照，Research-managed 节点是可以从其他表重建的子集（原 ticket 18 的"方案 A"）。拒绝原因：放弃了关系数据库对 Canvas 内容的查询/索引/约束能力（比如无法直接 `WHERE` 出"这个 canvas 上所有 Note 节点"），且和已经写进 `CONTEXT.md` 的"`canvas_state` 是可删可重建的缓存"这条原则冲突——如果原生内容焊死在 JSON blob 里，删了就是真的丢了，那条原则本身是错的。

这条决策对 [ADR 0005](./0005-candidate-acceptance-transaction-shape.md) 的更正：`canvas_state` 这个概念不再存在；`canvas_projections` 一节的措辞（"`canvas_projections` 不是节点总目录"）保留有效，只是现在它绑定的是 `canvas_nodes` 的行而不是一个假想的 `canvas_state` 快照里的元素。
