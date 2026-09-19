# `agent_messages` 直接存 Pi 的 `SessionEntry`，不发明独立的 CoResearch 会话模型

- 状态：accepted

[ADR 0006](./0006-agent-worker-pi-coding-agent-sdk.md) 定了"Postgres 是耐久真值、`SessionManager.inMemory()` 是运行时状态"，但没有定具体怎么对接。最初的预设是 CoResearch 需要自己的会话模型（`user_message`/`assistant_message`/`candidate_part`/`tool_event` 这类分类）加一层双向 adapter，翻译到/从 Pi 的 `AgentMessage`/`SessionEntry` 格式。核实 Pi 官方 `packages/coding-agent/docs/session-format.md` 后发现这个预设不成立：Pi 的 `AgentMessage` union（`system`/`user`/`assistant`/`toolResult`/`bashExecution`/`custom`/`branchSummary`/`compactionSummary`）已经覆盖我们需要的一切，`CustomMessage`（`{role:'custom', customType, content, display, details?, timestamp}`）正是 Pi 给第三方扩展留的结构化内容入口。

**决策**：`agent_messages` 表直接存 Pi 的 `SessionEntry`（`id`/`parent_id`/`entry_type`/`payload jsonb`，`payload` 是整条 entry 原样落库），不设计独立的 CoResearch 会话 schema。[ticket 12](../../.scratch/coresearch-saas-architecture/issues/12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md) 定的 `CandidatePart` 映射成 `CustomMessage`（`customType: 'research_candidate'`，字段进 `details`）。持久化只有单向：Agent Worker 产生一条 entry 就落一行，不需要往返转换。Worker 重启后用 `SessionManager.inMemory(cwd, options, entries)`（源码核实 `session-manager.ts:1614` 的第三参数 `entries?: FileEntry[]`）直接拿 Postgres 读出的行还原运行时会话。

一个刻意的例外：`accept_candidate` 触发时对已落库的 `custom` message 行做定向 `UPDATE` 回填 `details.materialized`，不追加新 entry——这是 Postgres 相对 Pi 默认 JSONL 文件的真实优势（文件只能追加，行可以更新），没有理由为了模仿"只追加"而放弃它。

**Resume 边界白得**：Pi 自己的约定是流式中间态（`stopReason: 'pending'`）绝不进入持久化的 session 文件，只有完整轮次才产出 entry。这意味着 Worker 崩在流式生成中途，`agent_messages` 最后一行天然就是"上一个完整轮次"，不需要额外设计"标记 interrupted、回滚到某个安全点"的逻辑——Pi 自己的持久化边界正好等于我们想要的 resume 边界（[ticket 19](../../.scratch/coresearch-saas-architecture/issues/19-agent-worker-run-scheduling.md) 直接复用这条）。

被拒绝的替代方案：独立的 CoResearch 会话 schema + 双向 adapter。拒绝原因：Pi 的 entry 形状本身会随版本演进（文档记录了 v1→v2→v3 的迁移历史，SDK 自带 `migrateToCurrentVersion`），维护一套平行 schema 意味着每次 Pi 升级都要人工同步两边的映射逻辑；直接存原始 entry，版本差异只需要在读出来时按 Pi 自己的迁移规则处理，不需要 CoResearch 重新发明一遍。
