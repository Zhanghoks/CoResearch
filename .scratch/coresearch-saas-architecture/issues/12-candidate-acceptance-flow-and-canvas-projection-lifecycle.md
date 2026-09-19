# 候选接受流程与 Canvas Projection 生命周期

Type: grilling
Status: resolved
Blocked by: 11

## Question

以 [Research Entity 生命周期与候选模型](11-research-entity-lifecycle-and-candidate-model.md) 的结论为前提：Conversation 里的候选卡片 → 用户拖拽/接受手势 → CoResearch API 的哪个命令/端点 → Research Entity 创建或更新 → Canvas Projection 创建，这条链路的具体契约是什么？

需要覆盖：
- 拖拽手势在前端怎么解析成 API 调用（沿用 Huabu 的 UiIntent → Command 两层，还是 SaaS 版直接精简）；
- 一个 Research Entity 获得第一条 Canvas Projection 之前，在 UI 上如何呈现（如果模型 A，候选卡片本身就是 UI；如果模型 B，还需要"待确认 Canvas 节点"这层）；
- Canvas 清空重建（`canvas_state` 是可丢弃缓存）时，`canvas_projections` 记录如何处理——已确认这张表不属于可丢弃缓存，重建只重新拼装 `canvas_state`，不重新分配 `node_id`；这里要把这条落实成具体的重建算法；
- 一个 Research Entity 被投影到多个 Canvas（V1 不发生，但 schema 要撑住）时，"接受"动作作用于哪个 Canvas 的投影，是否需要显式指定。

## Answer

**Candidate 的身份**：服务端签发稳定 `candidateId`（UUID/ULID），作为 `agent_messages` 结构化 content part 持久化，不用 `messageId + candidateIndex` 这种位置派生的身份（流式生成/消息重排会让位置漂移）：

```ts
type CandidatePart = {
  type: 'research_candidate'
  candidateId: string
  schemaVersion: 1
  kind: 'direction' | 'research_question' | 'problem' | 'hypothesis'
      | 'approach' | 'method' | 'evaluation'
  payload: unknown
  provenance: { runId: string; messageId: string; derivedFrom?: string[]; asOf?: string }
  materialized?: { entityId: string; at: string }
}
```

这条持久化在 `agent_messages`（Conversation/Agent Run 的状态），不在 `research_entities`——不违反 11 号定的"Candidate 不进 Research Domain"，因为 `agent_messages` 不是 Research Domain 的一部分。

**Accept 请求体只带 placement，不带语义内容**：

```ts
POST /api/projects/:projectId/candidates/:candidateId/accept
{ canvasId: string, placement: { position: { x, y }, parentNodeId?: string } }
```

服务端凭 `candidateId` 回读自己存的候选内容——客户端不能篡改"接受的是什么"，只能决定"放哪"。

**流程与事务边界**：单个 Postgres 事务，贯穿 canvas-engine 的持久化缝——`executeCanvasCommands` 本身是纯函数（不碰数据库，这是 §1 逆向文档已核实的设计），真正的风险点是宿主层 `executeOnServer` 的持久化步骤，如果在 accept 流程之外单独起自己的事务就会变成两次提交。正确做法是宿主把 accept 流程自己开的事务/连接传给 `executeOnServer` 复用，而不是各开一次：

```text
CandidateMaterializationService.accept(candidateId, placement)
  → 读 candidate（agent_messages），校验 project/run 归属、schema、是否已 materialized
  → BEGIN
      pg_advisory_xact_lock(canvasId)
      重新检查是否已 materialized（并发防护）
      INSERT research_entities（source_candidate_id = candidateId）+ 首条 revision
      调用共享引擎 CREATE_NODES 拿 server-assigned node id（同一事务连接）
      INSERT canvas_projections（entity_id / canvas_id / node_id）
      追加 canvas_deltas
    COMMIT
  → Supabase Realtime 广播
```

**幂等性**：`research_entities` 上加 `UNIQUE (project_id, source_candidate_id) WHERE source_candidate_id IS NOT NULL`。重复 accept（网络重试/双击）第二次直接命中约束冲突，服务端捕获后返回已存在的 `entityId`，不制造第二个实体。`CandidatePart.materialized.entityId` 是 UI 展示用的缓存，不是幂等性的最终防线，唯一约束才是。

**`canvas_state` 的正确公式（更正）**：不是"全部从 `canvas_projections` 导出"——Canvas 保留 Huabu 的原生节点类型（[ticket 01](01-canvas-engine-command-set.md) 已定的 `crEntity/frame/note/question/pdf/web`），只有 `crEntity` 这类是 Research-managed 投影。正确公式是 **Canvas 原生拓扑 + Research-managed 投影**：Research-managed 节点的语义内容来自 `research_entities` 当前 revision，几何来自 `canvas_layout`，绑定关系来自 `canvas_projections`；Canvas 原生节点（Note/PDF/Frame 等）内容和几何都只在 Canvas 自己的表里，不涉及 `research_entities`。`canvas_projections` 准确的含义是"哪些 Canvas 节点是某个 Research Entity 的托管投影"，不是"整个 Canvas 的节点目录"。

**Canvas Projection 生命周期**：

```text
ResearchEntity ──materialize──▶ CanvasProjection
  移动/缩放/换父          → 只改 Canvas 几何，不动实体
  实体 revision 变化      → 投影器刷新节点渲染内容，不新建节点
  从画布移除              → 删 Projection + Canvas 节点，ResearchEntity 存活
  之后重新投影            → 新 Projection + 新 node_id，同一个 ResearchEntity
```

**删除节点 ≠ 删除实体；Archive 实体 ≠ 自动摧毁投影**——已有投影在实体被 archive 后应该被投影器刷新成"已归档/已被取代"的可见状态，而不是从用户画布上悄悄消失。

详见 [ADR 0005](../../../docs/adr/0005-candidate-acceptance-transaction-shape.md)。
