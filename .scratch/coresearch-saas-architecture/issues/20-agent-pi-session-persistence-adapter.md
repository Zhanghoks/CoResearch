# CoResearch 会话模型 ↔ Pi AgentSession 的持久化适配契约

Type: grilling
Status: resolved

## Question

[ADR 0006](../../../docs/adr/0006-agent-worker-pi-coding-agent-sdk.md) 定了"Postgres（`agent_threads`/`agent_messages`）是耐久真值，`SessionManager.inMemory()` 是运行时状态"，但没有定具体的适配契约。CoResearch 自己的会话结构（[ticket 12](12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md) 定的 `agent_messages` 里带 `CandidatePart` 这种产品层结构化内容）和 Pi SDK 自己的 `AgentMessage`/session entry 格式不是同一回事，不能假设 `CandidatePart` 能原样塞进 Pi 的历史记录里喂给模型。

需要确定：
- CoResearch 的会话模型（`user_message`/`assistant_message`/`candidate_part`/`tool_event`/`provenance` 这类分类，具体字段待定）和 Pi 的消息格式之间，adapter 在哪一层、往哪个方向转换（Pi 消息 → 存进 Postgres 时转换一次，还是 Postgres 恢复 → 建 Pi session 时转换一次，还是两个方向都要）？
- `CandidatePart` 这类产品层结构化内容，要不要真的原样喂给模型作为对话历史的一部分（模型需要"记得"自己提过这个候选，才能在后续对话里引用），还是只在 UI 展示、模型侧用别的方式（比如工具返回值里的摘要）维持上下文？
- Worker 重启后从 Postgres 恢复 in-memory session 时，`SessionManager.inMemory()` 支持从外部保存的 entries 初始化（16 号核查时确认过这条能力存在）——具体用哪些 Postgres 记录重建，重建出来的 session 和原始运行时 session 在模型看来是否等价（会不会因为格式转换丢信息，导致模型行为在恢复前后不一致）？

这张 ticket 和 [19 号](19-agent-worker-run-scheduling.md) 都是 Agent Worker 内部机制，但关注点不同（19 是"怎么调度一个 run"，20 是"会话内容怎么在两套格式间转换"），互不阻塞，可并行。

## Answer

**没有两套格式要互相转换——`agent_messages` 直接存 Pi 自己的 `SessionEntry`/`FileEntry` 形状，不发明一套独立的 CoResearch 会话模型再写 adapter。** 这条推翻了 Question 里"CoResearch 会话模型（`user_message`/`assistant_message`/`candidate_part`/...）和 Pi 格式不是同一回事"的预设——核实 Pi 官方 `session-format.md` 后发现两者不需要是两回事：

- Pi 的 `AgentMessage` 已经是一个能装下我们需要的一切的 union（`system`/`user`/`assistant`/`toolResult`/`bashExecution`/`custom`/`branchSummary`/`compactionSummary`），每条 `SessionEntry` 都带 `id`/`parentId`/`timestamp`，天然是一棵树（我们只用它的线性子集，不需要暴露 fork/branch 给用户）。
- **`CandidatePart` 直接映射成 Pi 的 `CustomMessage`**（源码核实：`{ role: 'custom', customType: string, content, display: boolean, details?: any, timestamp }`——这正是 Pi 给第三方扩展留的结构化内容入口，不是我们在硬塞）：`customType: 'research_candidate'`，`details: { candidateId, schemaVersion, kind, payload, provenance, materialized? }`（[ticket 12](12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md) 定的字段原样搬进 `details`），`content` 放一段给模型读的简短文字摘要（"我提议了一个 Direction 候选：……"），`display: true` 让前端渲染成候选卡片。

**持久化方向只有一个**：Agent Worker 每产生一条 `SessionEntry`（Pi 自己在会话推进过程中生成的），原样落一行到 `agent_messages`（`id`/`parent_id`/`entry_type`/`payload jsonb`/`created_at`，`payload` 就是这条 entry 的 JSON）。不需要"Pi 消息→Postgres 转换一次，Postgres→Pi 恢复再转换一次"这种双向 adapter——两次都是同一个形状，读出来的行本身就是合法的 `FileEntry`。唯一的例外：`accept_candidate`（[12 号](12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md) 的浏览器直调端点，不是 Agent 工具）触发时，对已经落库的那条 `custom` message 行做一次**定向 UPDATE**，回填 `details.materialized = {entityId, at}`——这是 Postgres 相对 Pi 默认 JSONL 文件的一个真实优势（文件只能追加，行可以更新），不需要为了保持"只追加"而多写一条冗余 entry。`content`（喂给模型的文本）不因为这次回填而改变，只有 `details`（应用/UI 层元数据）变。

**Worker 重启后怎么恢复**：核实 `SessionManager.inMemory(cwd, options?, entries?: FileEntry[])` 的类型签名（`session-manager.ts:1614`）——第三个参数就是拿外部提供的 entries 直接种一个内存会话，不需要我们自己拼装 Pi 内部状态。重建 = `SELECT * FROM agent_messages WHERE thread_id = ? ORDER BY id` → 转成 `FileEntry[]`（本来就是同一形状，基本不用转换）→ `SessionManager.inMemory(cwd, opts, entries)`。

**Token 级流式不落库**：Pi 自己的约定是"`'pending'` 停止原因只出现在流式事件里，绝不出现在持久化的 JSONL 中"（`session-format.md` 原文）——也就是说 Pi 只在一条 assistant turn**完成**后才产出对应的 `SessionEntry`。这直接简化了 resume 语义（回答 [ticket 19](19-agent-worker-run-scheduling.md) 依赖的那个问题）：Worker 崩在某条 assistant 消息流式生成到一半，那条消息本来就没有被持久化过，`agent_messages` 里最后一行永远是"上一条完整轮次"，重建出来的 in-memory session 天然就是从上一个完整点续上，不需要额外写"标记 interrupted、回滚到上一个 durable turn"的特殊逻辑——Pi 自己的持久化边界已经等于我们想要的 resume 边界。

**Schema**：

```sql
agent_threads (id, project_id, created_at, pi_cwd)  -- pi_cwd 是传给 SessionManager 的 cwd 标识符，不是真实文件系统路径

agent_messages (
  id,                        -- = Pi SessionEntry.id
  thread_id references agent_threads(id),
  parent_id nullable,        -- = Pi SessionEntry.parentId，同一 thread 内的链
  entry_type,                -- = Pi SessionEntry.type（'message'/'model_change'/'compaction'/...）
  payload jsonb,             -- 整条 SessionEntry 原样存（含 message/role/content/details 等全部字段）
  created_at
)
```

不需要单独的 `entry_type`/字段拆分表——`payload` 整条存是刻意选择：Pi 的 entry 形状本身会随版本演进（`session-format.md` 自己说的"version 1/2/3"迁移），拆成规范化列意味着每次 Pi 升级都要迁移 schema；存 JSON 整条，迁移只需要在读出来时按需处理版本差异（Pi SDK 自己也是这么做的——加载旧 session 时自动跑 `migrateToCurrentVersion`）。
