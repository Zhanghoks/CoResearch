# 09: Proposal 审阅流程（Track B，V5）

**What to build:** Agent 对 08 号已确认的实体用 `propose_revision` 提一条修改；用户在 Idea Meta Space 侧栏（不是画布）看到 pending Proposal；accept 后校验 `baseStateRevision`（CAS，版本不符直接拒绝）、应用 `changes`、`research_entities.current_revision` 递增、画布上同一个节点内容刷新（不新建节点）；reject 后目标实体不变，Proposal 归档。

**Blocked by:** 08（需要真实 Agent 产出）、07（需要 ownership 边界已经验证过，Proposal accept 本质是另一条受控写入路径）。**当前不进入 execution frontier**——08 还没完成前不要认领这张。

**Status:** ready-for-agent

- [ ] `propose_revision` 端到端跑通：创建 `proposals` 行，`status:'pending'`
- [ ] Idea Meta Space 侧栏能读到 pending Proposal 列表
- [ ] Accept：`baseStateRevision` 不匹配当前 `current_revision` 时拒绝；匹配时应用 diff，revision 递增，插入新的 `research_entity_revisions` 行
- [ ] 已有 Canvas Projection 的节点内容刷新，不产生新的 `canvas_nodes` 行
- [ ] Reject：目标实体完全不变，`proposals.status` 变成 `rejected`
