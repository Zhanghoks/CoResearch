# 06: Deterministic Candidate → Accept → Projection（V3A）

**What to build:** 不接真实 LLM——直接写一条合法的 `CandidatePart` fixture（插入一行 `agent_messages`，`entry_type:'message'`，`payload.message.role:'custom'`，`customType:'research_candidate'`），前端能渲染出候选卡片；拖进画布触发 `POST /api/projects/:projectId/candidates/:candidateId/accept`，单事务创建 `research_entities` + 首条 `research_entity_revisions` + `canvas_nodes`（`crEntity`）+ `canvas_layout` + `canvas_projections` + `canvas_deltas`；重复 accept 同一个 `candidateId` 幂等返回已存在的 `entityId`；事务中途失败时全部回滚，不留半个投影。来源：[ADR 0005](../../../docs/adr/0005-candidate-acceptance-transaction-shape.md)/[ticket 12](../../coresearch-saas-architecture/issues/12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md)。

**Blocked by:** 05（需要能编辑的画布）、03（RLS）。

**Status:** ready-for-agent

- [ ] 手写 fixture 候选（不经 Agent Worker/Pi SDK）能被前端渲染成候选卡片
- [ ] Accept 端到端跑通：一次事务里创建实体+revision+节点+layout+projection+delta，`canvases.version` 递增
- [ ] `UNIQUE(project_id, source_candidate_id)` 幂等验证：同一 `candidateId` accept 两次，第二次直接返回第一次的 `entityId`，不产生第二个实体
- [ ] 故意让事务中途失败（比如插入 projection 前抛异常），验证已插入的 `research_entities` 行也被回滚，不留孤儿数据
- [ ] Realtime 收到这次 accept 产生的 delta，画布上出现新节点
