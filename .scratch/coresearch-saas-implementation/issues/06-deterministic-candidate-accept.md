# 06: Deterministic Candidate → Accept → Projection（V3A）

**What to build:** 不接真实 LLM——直接写一条合法的 `CandidatePart` fixture（插入一行 `agent_messages`，`entry_type:'message'`，`payload.message.role:'custom'`，`customType:'research_candidate'`），前端能渲染出候选卡片；拖进画布触发 `POST /api/projects/:projectId/candidates/:candidateId/accept`，单事务创建 `research_entities` + 首条 `research_entity_revisions` + `canvas_nodes`（`crEntity`）+ `canvas_layout` + `canvas_projections` + `canvas_deltas`；重复 accept 同一个 `candidateId` 幂等返回已存在的 `entityId`；事务中途失败时全部回滚，不留半个投影。来源：[ADR 0005](../../../docs/adr/0005-candidate-acceptance-transaction-shape.md)/[ticket 12](../../coresearch-saas-architecture/issues/12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md)。

**Blocked by:** 05（需要能编辑的画布）、03（RLS）。

**Status:** resolved

- [x] 手写 fixture 候选（不经 Agent Worker/Pi SDK）能被前端渲染成候选卡片
- [x] Accept 端到端跑通：一次事务里创建实体+revision+节点+layout+projection+delta，`canvases.version` 递增
- [x] `UNIQUE(project_id, source_candidate_id)` 幂等验证：同一 `candidateId` accept 两次，第二次直接返回第一次的 `entityId`，不产生第二个实体
- [x] 故意让事务中途失败（比如插入 projection 前抛异常），验证已插入的 `research_entities` 行也被回滚，不留孤儿数据
- [x] Realtime 收到这次 accept 产生的 delta，画布上出现新节点 —— **delta 入日志且含 presentation snapshot；真实双标签页 Realtime 未在浏览器里点过**

## Answer

`packages/research` 现在有 `CandidatePart` 解析（`candidateId === agent_messages.id`）、fixture SessionEntry 形状、以及 `entityPresentation` overlay。`POST .../candidates/fixture` 插入真实的 `agent_threads` + `customType:'research_candidate'` 行；`GET .../candidates` 列出来给 Agent 面板画卡片。

Accept 不走 `/execute`：`withCanvasMutex` 里回读候选 → insert entity+revision → `source:'system'` CREATE_NODES → `persistDeltas`（CAS 真检查）→ `canvas_projections`。`crEntity` 的 `native_data` 只留 `userNote`/`pinned`/`collapsed`；GET assemble 经 projection join 叠上当前实体字段。INSERT_NODE delta 带 presentation，所以 Realtime apply 能直接画出卡片。

重复 accept 命中已有 `(project_id, source_candidate_id)` 时返回同一 `entityId`/`nodeId`，不 bump 版本。`failBefore:'projection'`（仅测试入口）验证整事务回滚。PGlite：API 37/37，engine 16/16。

**没做到的**：和 04/05 一样，本会话没有真实登录会话，所以「拖进画布后另一标签页出现节点」没有在浏览器里点过。跨租户 404、幂等、回滚、GET overlay 都在 PGlite 里覆盖了。
