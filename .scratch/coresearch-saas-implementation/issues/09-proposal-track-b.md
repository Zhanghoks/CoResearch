# 09: Proposal 审阅流程（Track B，V5）

**What to build:** Agent 对 08 号已确认的实体用 `propose_revision` 提一条修改；用户在 Idea Meta Space 侧栏（不是画布）看到 pending Proposal；accept 后校验 `baseStateRevision`（CAS，版本不符直接拒绝）、应用 `changes`、`research_entities.current_revision` 递增、画布上同一个节点内容刷新（不新建节点）；reject 后目标实体不变，Proposal 归档。

**Blocked by:** 08、07。Milestone 1 已绿，已进入第二批。

**Status:** resolved

- [x] `propose_revision` 端到端跑通：创建 `proposals` 行，`status:'pending'`
- [x] Idea Meta Space 侧栏能读到 pending Proposal 列表
- [x] Accept：`baseStateRevision` 不匹配当前 `current_revision` 时拒绝；匹配时应用 diff，revision 递增，插入新的 `research_entity_revisions` 行
- [x] 已有 Canvas Projection 的节点内容刷新，不产生新的 `canvas_nodes` 行
- [x] Reject：目标实体完全不变，`proposals.status` 变成 `rejected`
