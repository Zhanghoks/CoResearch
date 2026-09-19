# CoResearch 会话模型 ↔ Pi AgentSession 的持久化适配契约

Type: grilling
Status: open

## Question

[ADR 0006](../../../docs/adr/0006-agent-worker-pi-coding-agent-sdk.md) 定了"Postgres（`agent_threads`/`agent_messages`）是耐久真值，`SessionManager.inMemory()` 是运行时状态"，但没有定具体的适配契约。CoResearch 自己的会话结构（[ticket 12](12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md) 定的 `agent_messages` 里带 `CandidatePart` 这种产品层结构化内容）和 Pi SDK 自己的 `AgentMessage`/session entry 格式不是同一回事，不能假设 `CandidatePart` 能原样塞进 Pi 的历史记录里喂给模型。

需要确定：
- CoResearch 的会话模型（`user_message`/`assistant_message`/`candidate_part`/`tool_event`/`provenance` 这类分类，具体字段待定）和 Pi 的消息格式之间，adapter 在哪一层、往哪个方向转换（Pi 消息 → 存进 Postgres 时转换一次，还是 Postgres 恢复 → 建 Pi session 时转换一次，还是两个方向都要）？
- `CandidatePart` 这类产品层结构化内容，要不要真的原样喂给模型作为对话历史的一部分（模型需要"记得"自己提过这个候选，才能在后续对话里引用），还是只在 UI 展示、模型侧用别的方式（比如工具返回值里的摘要）维持上下文？
- Worker 重启后从 Postgres 恢复 in-memory session 时，`SessionManager.inMemory()` 支持从外部保存的 entries 初始化（16 号核查时确认过这条能力存在）——具体用哪些 Postgres 记录重建，重建出来的 session 和原始运行时 session 在模型看来是否等价（会不会因为格式转换丢信息，导致模型行为在恢复前后不一致）？

这张 ticket 和 [19 号](19-agent-worker-run-scheduling.md) 都是 Agent Worker 内部机制，但关注点不同（19 是"怎么调度一个 run"，20 是"会话内容怎么在两套格式间转换"），互不阻塞，可并行。
