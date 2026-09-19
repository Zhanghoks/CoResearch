# Candidate 接受是单事务、幂等、服务端拥有语义的物化操作

- 状态：accepted

一次"接受候选"要跨两个概念上不同的领域写入：创建 Research Entity（project-scoped）和创建 Canvas Projection + 节点（canvas-scoped）。我们没有把这拆成两阶段+补偿，而是让它是一个 Postgres 事务：持有 `pg_advisory_xact_lock(canvasId)`（见 [ADR 0002](./0002-canvas-concurrency-and-realtime-sync.md)），插入 `research_entities`，在同一个事务连接上调用共享 canvas-engine 拿 server-assigned node id，插入 `canvas_projections`，提交。理由：Research Domain 和 Canvas 数据反正在同一个 Postgres 里，没有分布式事务的理由；两阶段+补偿只会在同一个数据库内部制造不必要的一致性窗口。

canvas-engine 的执行函数本身是纯函数，不持有数据库连接（见 `docs/design/canvas/huabu-reverse-engineering.md` §1.2 的逆向核实）——所以"贯穿持久化缝"说的不是给引擎传事务，而是宿主层负责持久化的那部分（`executeOnServer` 对应的落盘步骤）必须复用 accept 流程自己开的那个事务/连接，不能在流程之外单独提交一次。

**Candidate 身份**：服务端签发的稳定 `candidateId`（不用消息内位置派生的 id），作为 `agent_messages` 的结构化 content part 持久化，携带 `schemaVersion`、`kind`、`payload`、`provenance`、可选的 `materialized` 回填字段。Accept 请求体只携带 `candidateId` 和 `placement`（画布坐标/父节点），不携带语义内容——服务端凭 id 回读自己存的候选，客户端只能决定"放哪"不能决定"接受的是什么"。

**幂等性**：`research_entities (project_id, source_candidate_id)` 唯一约束是最终防线，不是应用层自己维护的去重表。重复 accept 命中约束冲突时返回已存在的 `entityId`。

被拒绝的替代方案：Accept 请求体携带候选的完整语义内容（标题/描述/证据），服务端不做候选持久化或回读。拒绝原因：客户端能篡改要接受的内容且失去天然幂等键；用 `messageId + candidateIndex` 当候选身份也被拒绝，因为流式生成和消息重排会让位置漂移，不是稳定身份。

`canvas_state` 的重建公式相应更正为"Canvas 原生拓扑（Frame/Note/PDF/Question/Web，见 [ticket 01](../../.scratch/coresearch-saas-architecture/issues/01-canvas-engine-command-set.md)）+ Research-managed 投影"，不是全部从 `canvas_projections` 导出——只有 `crEntity` 节点是 Research-managed 的，`canvas_projections` 表的准确含义是"哪些节点是托管投影"，不是节点总目录。
