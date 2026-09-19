# Agent 工具集与写入权限边界

Type: grilling
Status: resolved
Blocked by: 11, 16

## Question

原草稿（`/Users/zmj/.claude/plans/huabu-saas-breezy-heron.md` §1.5）提出 6 个受控工具：`search_literature` / `read_paper` / `propose_entities` / `read_research_state` / `canvas_commands` / `ask_user`。以 [11 号](11-research-entity-lifecycle-and-candidate-model.md) 定的两轨模型（Candidate 物化 / Proposal 修订，按操作语义区分）和 [16 号](16-agent-extension-architecture.md) 定的 SDK 选型（`@earendil-works/pi-coding-agent` 的 `defineTool()`/`customTools`，`tools:[...]` 显式白名单）为前提，需要钉死：

- `propose_entities`（Track A）：只把结构化候选写进 `agent_messages` 的 `CandidatePart`（见 [12 号](12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md)），从不直接写 `research_entities`——这条已经被 11/12 号定死，14 号只需要把它翻译成具体的 `defineTool()` 签名。
- 新增 `propose_revision`（Track B）：创建 `status:'pending'` 的 `Proposal` 行（[ADR 0004](../../../docs/adr/0004-candidate-vs-proposal-two-track-model.md)），用独立的服务函数入口（不是给 `propose_entities` 加参数）。
- `canvas_commands` 工具允许的命令子集：Agent 能不能直接调 `CONNECT_NODES` / `SET_NODE_GEOMETRY` 这类布局命令，还是布局类命令也一律走 Conversation 建议、用户手动操作？
- 越权检查放在哪一层：按 16 号的结论，Agent 能调用的每个工具都是显式 `defineTool()` 注册的、白名单里的一员，本身不含 `accept_candidate`/`accept_proposal`/`archive_entity` 这类用户确认动作（这几个永远不注册成 Agent Tool）；实际的所有权/CAS 校验要不要在 `defineTool()` 的 `execute()` 内部做，还是统一收口到 CoResearch API 的 ownership guard 让 `execute()` 只是转发。

## Answer

**`canvas_commands` 从 V1 工具集里去掉**——推导过程见 [ADR 0007](../../../docs/adr/0007-agent-tool-set-drops-canvas-commands.md)：两轨模型下所有实体创建/画布投影都绑定在用户的"接受"动作上（浏览器直接调 API，不是 Agent 工具），Agent 没有合法场景需要直接发画布命令。

**最终工具表**（`RESEARCH_TOOL_ALLOWLIST`，即 [ADR 0006](../../../docs/adr/0006-agent-worker-pi-coding-agent-sdk.md) 的 `createCoResearchAgentSession()` 写死传给 SDK `tools:[...]` 的值）：

| Tool | 轨道 | 写 Research Domain | 写 Canvas | 说明 |
|---|---|---|---|---|
| `search_papers` | 只读 | ✗ | ✗ | 外部文献 API（[15 号](15-paper-canonicalization-provenance-freshness.md) 的 Semantic Scholar/OpenAlex/Crossref/arXiv 组合），改用这个名字而不是原草稿的 `search_literature`，和 16 号已经用过的命名一致 |
| `read_paper` | 只读 | ✗ | ✗ | 读项目内已导入/缓存的论文，scope 到 `projectId` |
| `inspect_research_state` | 只读 | ✗ | ✗ | 读当前 Research Entity + Relation，scope 到 `projectId` |
| `propose_candidates` | Track A | ✗（只写 `agent_messages` 的 `CandidatePart`） | ✗ | 见 [11](11-research-entity-lifecycle-and-candidate-model.md)/[12](12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md) 号 |
| `propose_revision` | Track B | ✓（`Proposal` 行，`status:'pending'`） | ✗ | 独立服务函数入口，不是 `propose_candidates` 加参数 |
| `ask_user` | 无副作用 | ✗ | ✗ | 请求澄清，不涉及权限 |

**永远不注册成 Agent Tool**（无论哪个工具都不能达成这些效果）：`accept_candidate`（[12 号](12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md) 定的浏览器直调端点）、`accept_proposal`/`apply_proposal`（用户在 Idea Meta Space 审阅后触发）、`archive_entity`、任何画布几何/连线命令。这几个是"user-confirmed semantic transition"，只能由浏览器发起的、非 Agent 上下文的请求触发。

**越权检查放在哪一层**：统一收口到服务层，不在每个 `defineTool().execute()` 里各自实现一遍。`propose_candidates`/`propose_revision`/`inspect_research_state` 等工具的 `execute()` 是薄封装，直接调用 CoResearch API 内部的同一套服务函数（`proposeCandidate()`/`proposeRevision()`/`readResearchState()`），这些函数本身携带 `RequestContext`（scope 到当前 run 所属的 `projectId`）并做所有权/CAS 校验——校验逻辑只存在一份，Agent Worker 和普通 HTTP 请求路径复用同一份，不是"Agent Worker 自己再抄一遍 ownership guard"。这条延续 [ADR 0001](../../../docs/adr/0001-hybrid-backend-supabase-as-infra.md) 的"权限判定落在函数入口"原则。
