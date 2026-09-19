# Agent 工具集 V1 不含 `canvas_commands`

- 状态：accepted

原草稿（`/Users/zmj/.claude/plans/huabu-saas-breezy-heron.md` §1.5）提出的 6 个工具里有 `canvas_commands`，允许 Agent 发布画布命令批次（仅布局类）。这条是在 [ADR 0004](./0004-candidate-vs-proposal-two-track-model.md) 的两轨模型和 [候选接受流程](../../.scratch/coresearch-saas-architecture/issues/12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md) 定下来之前写的，现在推导一遍发现没有站得住的用例：Track A（Candidate）的实体创建和首条 Canvas Projection 只在用户"接受"（拖拽）的瞬间同时发生，接受动作是浏览器直接调用的 API，不是 Agent 工具；Track B（Proposal）从不产生 Canvas node；地图 Hard Constraint 4 "Canvas 是 Commitment Space" 意味着几何/连线默认是用户或投影器的职责，不是 Agent 中途插手的对象。三条放在一起，V1 找不到一个 Agent 需要直接发画布命令的合法场景。

**决策**：V1 的 Agent 工具集不包含任何画布命令能力。Agent 能做的只有：读（文献检索、读论文、读研究状态）、Track A 提案（写 Candidate 到 `agent_messages`）、Track B 提案（写 `Proposal` 行）、请求澄清。移动/缩放/连线/父子关系全部走用户手势（Huabu 的 UiIntent→Command 两层，瘦身后的 V1 版本）或投影器（Canvas Projection 生命周期，见 ticket 12）。

再次触发这条决策的条件：出现真实产品需求要让 Agent 主动安排画布布局（比如 Deep Dive 生成一批节点后自动分组摆放）——即便那时，也应该优先考虑做成"接受时的一个可选布局参数"（Track A 的一部分，仍是用户触发），而不是给 Agent 一个独立的、随时可调的画布命令工具；只有这个方向被证明不够用，才重新考虑独立工具。

被拒绝的替代方案：保留 `canvas_commands` 但限定命令子集（只允许 `SET_NODE_GEOMETRY`/`SET_NODE_PARENT` 这类几何类）。拒绝原因：即使限定子集，也需要回答"Agent 什么时候、基于什么触发条件会调用它"，而两轨模型下所有实体创建都已经绑定在用户的接受动作上，找不到一个几何调整脱离用户触发还合理的时机——保留这个工具只会制造一个没人用但要维护的攻击面。
