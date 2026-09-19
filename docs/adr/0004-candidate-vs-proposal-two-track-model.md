# 两轨状态模型：Candidate（物化）与 Proposal（修订）按操作语义区分，不按 entity kind 硬编码

- 状态：accepted

Agent 提出的内容分两种性质完全不同的写入意图：一种问"这个研究对象要不要纳入我的研究空间"（Direction/Research Question/Approach 从候选里选一个），一种问"要不要修改一个已经存在的对象"（编辑已确认 Problem 的 scope、修正 Hypothesis 的机制描述）。我们没有按 entity kind 分配轨道（比如"Direction 走 A 轨、Problem 走 B 轨"），因为同一个 entity kind 在不同时刻会两种意图都遇到——Problem 第一次从候选里选出来是物化，之后被建议改 scope 是修订。轨道由当前这次写入的操作语义决定。

**Track A（Candidate → Materialized Entity）**：候选是纯 Conversation/Agent run 里的临时对象，不进 `research_entities`，不产生 Canvas node，可以被自由丢弃而不需要留 rejected 行。用户保存/拖拽的瞬间同时创建 Research Entity、首条 revision、以及（如适用）首条 Canvas Projection。**保存不等于确认进入下一阶段**——Direction 的完整链路是 `proposed → drag → saved → "我对这个最感兴趣" → selected_for_deep_dive`，中间还有一步用户显式动作。

**Track B（Proposal → Entity Revision）**：复用 `docs/design/idea-structure.md` §3.1 已经定义的 `Proposal` 对象（持久化、带 `baseStateRevision` 防止基于旧版本改写、`changes[]` 是显式 diff、`status: pending|accepted|rejected|superseded`）。Proposal 从不产生 Canvas node，通过 Idea Meta Space（不是 Canvas——这是两个不同的 UI 层，见 [ADR 0003](./0003-project-canvas-cardinality.md) 之前的术语消歧）呈现给用户审阅；接受时校验 revision、应用 diff、目标实体 revision 递增，若已有 Canvas Projection 则只重渲染节点内容，不新建节点。

`Proposal.kind` 现有的五个值（`clarification | problem | hypothesis | revision | pivot`）需要扩展到能覆盖 `direction` / `approach` / `research_question` 这些语义区域——因为已确认实体的后续修改统一走 Proposal，不为每个 entity kind 发明专属修订机制。

直接后果（落到 [Agent 工具集与写入权限边界](../../.scratch/coresearch-saas-architecture/issues/14-agent-tool-write-permission-boundary.md)）：Agent 能提出世界，不能自行承诺世界——`propose_entities`（Track A）从不直接写 `research_entities`，`propose_revision`（Track B）只能创建 `status: pending` 的 Proposal 行；真正的实体创建/修改只发生在用户显式 accept 的路径上，且这两类写入通过不同的服务函数入口区分（不是同一个函数传参数），延续 [ADR 0001](./0001-hybrid-backend-supabase-as-infra.md) 的权限判定原则。

被拒绝的替代方案：按 entity kind 分配轨道（"Direction/RQ/Approach 永远走 Track A，Problem/Hypothesis 永远走 Track B"）。拒绝原因是这会在 Problem 第一次被选出、之后又要被修改这类真实场景里制造出两套不一致的写入路径，且未来任何实体一旦支持"编辑已确认内容"都要重新决定它算 Track A 还是 Track B——按操作语义分轨从根上避免了这个问题。
