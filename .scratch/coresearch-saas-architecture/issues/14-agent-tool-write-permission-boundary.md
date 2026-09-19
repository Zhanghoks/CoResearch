# Agent 工具集与写入权限边界

Type: grilling
Status: open
Blocked by: 11, 16

## Question

原草稿（`/Users/zmj/.claude/plans/huabu-saas-breezy-heron.md` §1.5）提出 6 个受控工具：`search_literature` / `read_paper` / `propose_entities` / `read_research_state` / `canvas_commands` / `ask_user`。以 [11 号](11-research-entity-lifecycle-and-candidate-model.md) 定的两轨模型（Candidate 物化 / Proposal 修订，按操作语义区分）和 [16 号](16-agent-extension-architecture.md) 定的 SDK 选型（`@earendil-works/pi-coding-agent` 的 `defineTool()`/`customTools`，`tools:[...]` 显式白名单）为前提，需要钉死：

- `propose_entities`（Track A）：只把结构化候选写进 `agent_messages` 的 `CandidatePart`（见 [12 号](12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md)），从不直接写 `research_entities`——这条已经被 11/12 号定死，14 号只需要把它翻译成具体的 `defineTool()` 签名。
- 新增 `propose_revision`（Track B）：创建 `status:'pending'` 的 `Proposal` 行（[ADR 0004](../../../docs/adr/0004-candidate-vs-proposal-two-track-model.md)），用独立的服务函数入口（不是给 `propose_entities` 加参数）。
- `canvas_commands` 工具允许的命令子集：Agent 能不能直接调 `CONNECT_NODES` / `SET_NODE_GEOMETRY` 这类布局命令，还是布局类命令也一律走 Conversation 建议、用户手动操作？
- 越权检查放在哪一层：按 16 号的结论，Agent 能调用的每个工具都是显式 `defineTool()` 注册的、白名单里的一员，本身不含 `accept_candidate`/`accept_proposal`/`archive_entity` 这类用户确认动作（这几个永远不注册成 Agent Tool）；实际的所有权/CAS 校验要不要在 `defineTool()` 的 `execute()` 内部做，还是统一收口到 CoResearch API 的 ownership guard 让 `execute()` 只是转发。
