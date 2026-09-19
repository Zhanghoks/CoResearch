# Canvas 同步传输 与 Agent 流式传输 不能共用同一条通道

Type: grilling
Status: open

## Question

[ADR 0002](../../../docs/adr/0002-canvas-concurrency-and-realtime-sync.md) 定的是 **Canvas 状态**的同步传输（Supabase Realtime 订阅 `canvas_deltas` + durable catch-up API）。**Agent 一次 run 的 token 级流式输出**（`message.delta`/`tool.started`/`tool.updated`/`tool.completed` 这类事件，源自 [ADR 0006](../../../docs/adr/0006-agent-worker-pi-coding-agent-sdk.md) 提到的"事件经 adapter 转译"）没有定传输方式，且不应该默认复用 Supabase Realtime——Realtime 是给"数据库行变更通知"设计的，不是给"每秒几十次的 token 流"设计的，语义和吞吐特征都不一样，强行塞进同一条通道会让两种完全不同的实时性需求互相干扰。

需要确定：
- Agent run 的实时流走什么传输：API 自己的 SSE 端点（`GET /api/runs/:runId/stream` 这类），还是别的？
- 关键的 Agent 事件/消息最终要落 Postgres（`agent_messages`）供 [20 号](20-agent-pi-session-persistence-adapter.md) 的恢复机制使用——落库的时机是每个事件都写，还是攒到 turn 结束才写一次（后者吞吐更低但恢复时会丢失"当前 turn 说到一半"的状态）？
- 浏览器同时订阅 Canvas 同步（Supabase Realtime）和 Agent 流（API SSE）两条通道时，前端状态管理要不要统一成一个事件总线，还是各自独立处理——这条决定前端契约的形状，值得在这里定下来而不是留给前端实现时各自发挥。
