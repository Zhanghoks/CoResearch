# `canvas_state` 的规范存储形态：整体快照 vs 规范化表

Type: grilling
Status: resolved

## Question

[ticket 12](12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md)/[ADR 0005](../../../docs/adr/0005-candidate-acceptance-transaction-shape.md) 把 `canvas_state` 的公式更正为"Canvas 原生拓扑（Frame/Note/PDF/Question/Web）+ Research-managed 投影"，但没有回答一个更根本的问题：**Canvas 原生节点的内容和几何，规范存储在哪？**

两个方案没有二选一：

- **方案 A**：`canvas_state`（`{project_id/canvas_id, version, nodes jsonb, edges jsonb}`）本身就是 Canvas 原生拓扑的权威存储——Research-managed 节点是其中一个可以从 `canvas_projections`+`research_entities`+`canvas_layout` 重新拼出来的子集，但 Note/Frame/PDF 这些原生节点的内容只存在 `canvas_state` 这个 JSON 快照里，删了就是真的丢了。
- **方案 B**：`canvas_nodes`/`canvas_edges`/`canvas_layout`/`canvas_projections` 都是规范化的 canonical 表（每种节点类型的内容和几何有自己的行），`canvas_state` 降级成一份完整渲染快照/缓存，可以整体删除重建，不是任何东西的唯一存储位置。

选 B 的理由：CoResearch 已经是 Postgres SaaS，不是 Huabu 那种"文件即状态"的单机应用，把 Canvas 原生内容焊死在一个 JSON blob 里放弃了关系数据库的查询/索引/约束能力（比如没法直接 `WHERE` 出"这个 canvas 上所有 Note 节点"）；也和已经定的"`canvas_state` 是可删可重建的缓存"这条原则更一致——如果 A 成立，那句话就是错的，需要回去改 `CONTEXT.md`。

需要确定：选 A 还是 B；如果选 B，`canvas_nodes` 要不要覆盖 Research-managed 节点（即 `canvas_projections` 是不是 `canvas_nodes` 的一个子类型/外键，而不是平行的表），还是保持 `canvas_projections` 独立、只有原生节点进 `canvas_nodes`。

## Answer

**选 B，且 `canvas_projections` 是 `canvas_nodes` 的 binding，不是平行的第二套节点体系。**`canvas_state`（原来设想的整体 JSON 快照）不再存在——`canvas_nodes` 本身就是权威存储，不需要再有一份"可删可重建的缓存"概念，因为已经没有别的东西可以从它重建了。这条更正了 [ADR 0005](../../../docs/adr/0005-candidate-acceptance-transaction-shape.md) 里"`canvas_state` 是可丢弃缓存"的表述——那条在 ADR 0005 写的时候还没解决"原生节点存哪"这个问题，现在解决了，`canvas_state` 这个概念本身被 `canvas_nodes` 取代。

理由不是"更干净"，是共享引擎的数据模型逼出来的：8 条命令（`CREATE_NODES`/`SET_NODE_PARENT`/`normalizeTreeOrder` 等）对节点类型无感，`@xyflow/react` 的 `Node.type` 只是 `data` payload 形状的判别式；两套平行表会让引擎需要知道"这条命令该往哪张表插"，这是在给一个类型无关的执行器强加类型分支。[13 号](13-direction-deep-dive-data-model.md) 带出的"Phase Frame 的子节点可能是 crEntity"需求也要求 `parent_node_id` 是同一张表内的自引用外键，否则要处理"父节点可能在表 A 也可能在表 B"的多态外键。

**Schema**（Huabu `CanvasCommand`/`SET_NODE_PARENT` 核实：节点统一抽象成 `CanvasNodeCreateInput`/`CanvasNodeId`，`nodeType` 只是判别式——持久层分两套 inventory 会给引擎强加它原本没有的类型分支，这条在 §理由 已经论证过，这里补上一次源码交叉核对）：

```sql
canvases (
  id, project_id, title,
  version                  -- 唯一权威的 Canvas 版本计数器；canvas_deltas.from/to_version 与它对齐，
                             -- 不允许出现第二个"版本"字段（比如以后加了缓存快照，快照自己的
                             -- version 只能是"这份快照基于哪个 canvases.version 构建"，不能被
                             -- 误当成权威计数器）
)

canvas_nodes (
  id,                       -- 稳定 node_id，CREATE_NODES 服务端分配
  canvas_id,
  node_type,                -- 'note' | 'frame' | 'pdf' | 'question' | 'web' | 'crEntity'
  parent_node_id nullable references canvas_nodes(id),  -- 同表自引用，见 SET_NODE_PARENT
  native_data jsonb         -- 只装"画布原生 authored 内容"：Note 正文、PDF 引用、Question
                             -- thread 锚点；crEntity 行这列最多装"画布层的批注/用户笔记"这类
                             -- Canvas 自己拥有的附加数据，绝不装语义内容——语义内容永远来自
                             -- research_entities，不允许在这里出现第二份真值
)

canvas_layout (
  node_id primary key references canvas_nodes(id),
  x, y, width, height, z_order, pinned, collapsed,
  frame_column nullable,   -- 追加（ADR 0010）：对应 Huabu 的 frameColumn，只有父是
  frame_row nullable       -- structured frame 的子节点才有值，对应 frameRow
)
-- 拆回独立表：canvas_nodes 管"这个节点是什么"（身份/拓扑/原生内容），
-- canvas_layout 管"它在哪、多大"（几何），关注点分离，不是为了"缓存重建时存活"
-- （那条理由随 canvas_state 一起消失了，但拆分本身仍然是更干净的表达）。

canvas_edges (
  id, canvas_id, source_node_id, target_node_id, edge_type, created_by  -- 'user' | 'system'
)
-- 只存"纯画布"的边（用户手动连的、不对应任何 research_relations 的连线）。
-- 代表研究关系的边不存这里：两个 crEntity 节点之间的边，是投影器在渲染时
-- 从 research_relations × canvas_projections 计算出来的虚拟边（两端都在这个
-- canvas 上有投影才出现，这条 12 号已经定过），不持久化成一行。这条延续
-- "Canvas 不以几何/连线定义语义"——语义连接只有 research_relations 一个真值源。

canvas_projections (
  node_id primary key references canvas_nodes(id),  -- 0..1：一个 Canvas node 最多绑一个 entity，
                                                       -- 只有 node_type='crEntity' 的行有对应记录
  canvas_id,
  entity_id references research_entities(id),        -- 不加 UNIQUE(canvas_id, entity_id)：
                                                       -- 同一个实体允许被多个节点/多张 canvas 各自
                                                       -- 投影一次（比如同一篇论文同时出现在
                                                       -- "Milestone Papers"和"Method lineage"两个
                                                       -- 区域），产品明确要求"同一 canvas 上唯一"
                                                       -- 之前不要过早锁死
  revision_policy,          -- 'latest' | 'pinned'：这条投影怎么跟踪实体的 revision 变化
  pinned_revision nullable, -- revision_policy='pinned' 时锁定的具体 revision
  projector_version         -- 生成这条投影时的投影器版本，供以后升级投影逻辑时判断要不要重投
)

canvas_deltas (canvas_id, from_version, to_version, deltas jsonb, ts)
```

**不变量**（应用层/事务层保证，V1 不做跨表 DB constraint——Postgres 原生不支持跨表 CHECK，要做就得上 constraint trigger，阶段二再评估值不值得）：**一条 `canvas_projections` 记录存在，当且仅当对应的 `canvas_nodes.node_type = 'crEntity'`**。[12 号](12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md) 的 accept 事务是保证这条不变量的唯一入口：

```text
BEGIN
  pg_advisory_xact_lock(canvas_id)
  INSERT research_entities + 首条 revision
  共享引擎 CREATE_NODES（拿 server-assigned node id）
  INSERT canvas_nodes（node_type='crEntity'）
  INSERT canvas_layout（初始位置）
  INSERT canvas_projections（绑定 entity_id）
  bump canvases.version
  INSERT canvas_deltas
COMMIT
```

**重建算法**（验证"删掉任何缓存都不丢用户 authored state"这条验收条件）：

```text
1. SELECT canvas_nodes WHERE canvas_id
2. JOIN canvas_layout ON node_id
3. 原生节点：data ← native_data
4. crEntity 节点：binding ← canvas_projections；语义内容 ← research_entities 当前 revision；
                  画布层批注（如有）← native_data
5. SELECT canvas_edges WHERE canvas_id（原生边）
6. 计算虚拟关系边：research_relations × canvas_projections（两端都有投影才出现）
7. 拼成 CanvasReadState 交给共享引擎，或拼成前端读模型
8. 可选：按 canvases.version 做缓存键缓存这份拼装结果——这份缓存纯衍生，从不是写入目标
```

**和已有决策的兼容性**：[12 号](12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md) 的 accept 流程语义不变，上面已经把新 schema 下的具体步骤列出来了。[ticket 01](01-canvas-engine-command-set.md) 的 8 条命令集不用改。

`CONTEXT.md` 的 Canvas Projection 词条需要同步更新（不再是"独立表决定节点是否存在"，而是"`canvas_nodes` 行 + 可选的 `canvas_projections` binding"）。详见 [ADR 0008](../../../docs/adr/0008-canvas-canonical-storage-unified-nodes.md)。
