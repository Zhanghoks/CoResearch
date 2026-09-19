# Agent 流式传输走 API 自己的 SSE + Postgres LISTEN/NOTIFY，不复用 Supabase Realtime

- 状态：accepted

[ADR 0002](./0002-canvas-concurrency-and-realtime-sync.md) 定的 Supabase Realtime 快路径是给 Canvas 状态变更设计的（订阅 `canvas_deltas` 表的 INSERT）。Agent 一次 run 的 token 级流式输出（`message_update`/`tool_execution_update` 等）语义和吞吐特征都不一样——Realtime 要求"有表变更才有通知"，如果借用它就得为每个 token delta 写一行本不需要持久化的数据，正是要避免的"token 级写入轰炸"。

**决策**：Agent run 的实时流走 CoResearch API 自己的 SSE 端点（`GET /api/runs/:runId/stream`）。Agent Worker 是独立进程（[ticket 03](../../.scratch/coresearch-saas-architecture/issues/03-agent-worker-process-boundary.md)），不直接面向浏览器，中间用 **Postgres `LISTEN`/`NOTIFY`** 做 Worker→API 的进程间转发：Worker 处理一次 Pi 事件就 `NOTIFY agent_run_<runId>`，API 对应连接 `LISTEN` 同一 channel 后转发给 SSE 客户端。选它不是因为它是最强的消息总线，是因为它是纯 pub/sub、不落任何行——不用为了"有通知"而被迫持久化不该持久化的东西，且不引入 Redis（[ADR 0002](./0002-canvas-concurrency-and-realtime-sync.md) 已定的一贯原则）。已知约束：`NOTIFY` payload 上限 8000 字节，超大的工具中间输出需要先截断/摘要再发。

落库时机不是这里的新决策——[ADR 0011](./0011-agent-messages-store-pi-session-entries-directly.md) 已经确立 Pi 只在轮次完整完成时才产出 `SessionEntry`，Worker 收到就写 `agent_messages`；轮次中的子事件只走 `NOTIFY`/SSE，从不进 Postgres。这条本身是 Pi 的持久化粒度决定的，不是为了吞吐做的取舍。

**两条通道的保证级别刻意不同**：Canvas 用 `canvas_deltas` + `afterVersion` 做精确补漏（[ADR 0002](./0002-canvas-concurrency-and-realtime-sync.md)）——几何/结构变化是用户看得见的编辑历史，丢不起。Agent SSE 断线重连后不补丢失的流式中间态——那是"正在打字"的瞬时呈现，浏览器等下一个完整 entry 或读 `GET /api/threads/:threadId/messages` 拿历史即可，不需要专门的 gap-detection catch-up API。

前端不强行把两条通道塞进一个统一事件总线——建议两个独立的订阅 hook（`useCanvasSync`/`useAgentRunStream`），具体形状留给阶段二的前端契约 spec，这条是实现倾向不是硬约束。

被拒绝的替代方案：Agent 流复用 Supabase Realtime（理由见上，会制造不必要的写入）；Worker→API 之间引入 Redis pub/sub（不需要，`LISTEN`/`NOTIFY` 已经是够用的 Postgres 原生原语）。
