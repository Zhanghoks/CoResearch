# Research Entity 生命周期与 Agent-proposed/user-confirmed 状态模型

Type: grilling
Status: resolved

## Question

`docs/design/research-flow.md` 已经验证了 Direction 这一步的模式：**候选只存在于 Conversation，用户拖入 Canvas 的瞬间才同时创建 Research Entity 和第一条 Canvas Projection**（"Direction Candidate 首先只存在于 Conversation"，见该文档第 2 节）。

但 Problem Formation（第 5 步）等下游步骤只写了"Exit Gate：用户确认 Problem"，没有说候选阶段是否已经是一个 `confirmed:false` 的 Research Entity 并投影在 Canvas 上（可能显示为"待确认"视觉态）。这是两种不同的产品模型：

- **模型 A（Direction 已验证）**：候选不触碰 Research Domain / Canvas，接受时才同时创建实体+投影。
- **模型 B（Huabu 托管字段机制的直接类比）**：候选本身就是 `confirmed:false` 的 Research Entity，被投影到 Canvas 上，用户在详情面板里确认。

需要按 `research-flow.md` §6 逐个 entity kind（Direction / Research Question / Problem / Hypothesis / Approach / Method / Evaluation / Idea）过一遍，确定每一种是模型 A、模型 B，还是随步骤变化的第三种形态；顺带定义 `status` / `origin` / `confirmed` / `revision` / `refContentHash` 这几个字段在跨 entity kind 时是否统一语义（原草稿的判断是"原样携带不做归一"，因为不同步骤的枚举值语义方向可能相反，需要在这里验证）。

这张 ticket 的结论会决定 [候选接受流程与 Canvas Projection 生命周期](12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md)、[Direction Deep Dive 数据模型](13-direction-deep-dive-data-model.md)、[Agent 工具集与写入权限边界](14-agent-tool-write-permission-boundary.md) 三张 ticket 的具体形状，所以它们都 block 在这张 ticket 上。

## Answer

采纳两轨模型，但**两条机制按"操作语义"区分，不按 entity kind 硬编码**——同一个 entity kind（比如 Problem）在不同时刻可能走不同的轨道，取决于当前这次写入问的是"要不要让这个对象存在"还是"要不要修改一个已存在的对象"。

**Track A — Candidate → Materialized Entity**（回答"这个研究对象要不要纳入我的研究空间？"）：

```text
Agent Conversation
    ↓
ephemeral Candidate（不进 research_entities，不产生 Canvas node，
                     可以跟着当前 run/conversation 存活或被丢弃，
                     不需要为每个被忽略的候选制造 rejected 行）
    ↓ user 保存/drag
create ResearchEntity + create initial revision + create CanvasProjection（如适用）
    ↓
saved
    ↓ 用户后续显式动作（因步骤而异）
selected / active / confirmed-for-next-stage
```

**关键更正**：`saved ≠ confirmed`。Direction 的完整链路是 `proposed in conversation → drag → saved Direction → "我对这个最感兴趣" → selected_for_deep_dive`——保存只是首次物化，不是确认进入下一阶段。这条同样适用于 Research Question（"保存到 Canvas"之后还有独立的 literature-status 演化）和 Approach。

**Track B — Proposal → Entity Revision**（回答"要不要修改一个已存在的对象？"）：复用 `idea-structure.md` §3.1 已定义的 `Proposal` 对象——持久化、带 `baseStateRevision`、`changes[]`、`rationale`、`status: pending|accepted|rejected|superseded`；**Proposal 本身从不产生 Canvas node**，通过 Idea Meta Space（不是 Canvas）呈现给用户审阅。接受时校验 `baseStateRevision`、应用 `changes`、entity revision 递增、如果目标已有 Canvas Projection 则只重新渲染节点内容，不新建节点。拒绝时保留/归档 Proposal 作为审阅历史，不改动目标实体。

`Proposal.kind`（`clarification | problem | hypothesis | revision | pivot`）因此应理解为**"这条 Proposal 修改的语义区域"**，不是"只有这几种 entity kind 能走 Proposal"。举例：Research Question 形成 Problem 的第一次（Agent 给 3 个候选 Problem，用户选一个）走 Track A；已确认的 Problem 被建议"把 scope 从 continual harness 缩到 sequential edits"走 Track B（`Proposal(kind='problem')`）。同理 Hypothesis：首次多机制候选选择是 Track A，修改已确认 Hypothesis 是 Track B。

**Hard Rule**：*A Candidate asks "should this object exist?"; a Proposal asks "should an existing object change?"*——这条已并入地图 Notes 的 Hard Constraints（见 map.md #13），跨所有下游 ticket 生效。

已确认实体的修改统一走 Proposal 机制（不管这个实体最初是从 Track A 落地还是从别处来的）——Direction/Research Question/Approach 一旦物化为 ResearchEntity，后续对其内容的修改和 Problem/Hypothesis 走同一套 Proposal 流程，不需要另外发明"Direction 专属的修订机制"。这也是为什么 `Proposal.kind` 未来要能覆盖 `direction`/`approach`/`research_question` 这些语义区域，不止 idea-structure.md 当前列出的五个。

