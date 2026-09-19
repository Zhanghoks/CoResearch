# Canvas 同步传输 与 Agent 流式传输 不能共用同一条通道

Type: grilling
Status: resolved

## Question

[ADR 0002](../../../docs/adr/0002-canvas-concurrency-and-realtime-sync.md) 定的是 **Canvas 状态**的同步传输（Supabase Realtime 订阅 `canvas_deltas` + durable catch-up API）。**Agent 一次 run 的 token 级流式输出**（`message.delta`/`tool.started`/`tool.updated`/`tool.completed` 这类事件，源自 [ADR 0006](../../../docs/adr/0006-agent-worker-pi-coding-agent-sdk.md) 提到的"事件经 adapter 转译"）没有定传输方式，且不应该默认复用 Supabase Realtime——Realtime 是给"数据库行变更通知"设计的，不是给"每秒几十次的 token 流"设计的，语义和吞吐特征都不一样，强行塞进同一条通道会让两种完全不同的实时性需求互相干扰。

需要确定：
- Agent run 的实时流走什么传输：API 自己的 SSE 端点（`GET /api/runs/:runId/stream` 这类），还是别的？
- 关键的 Agent 事件/消息最终要落 Postgres（`agent_messages`）供 [20 号](20-agent-pi-session-persistence-adapter.md) 的恢复机制使用——落库的时机是每个事件都写，还是攒到 turn 结束才写一次（后者吞吐更低但恢复时会丢失"当前 turn 说到一半"的状态）？
- 浏览器同时订阅 Canvas 同步（Supabase Realtime）和 Agent 流（API SSE）两条通道时，前端状态管理要不要统一成一个事件总线，还是各自独立处理——这条决定前端契约的形状，值得在这里定下来而不是留给前端实现时各自发挥。

## Answer

**传输**：`GET /api/runs/:runId/stream`，CoResearch API 自己的 SSE 端点。但 Agent Worker 是独立进程（[ticket 03](03-agent-worker-process-boundary.md)），不直接面向浏览器——Worker 产生的事件要先到 API 才能转成 SSE，中间这段用 **Postgres `LISTEN`/`NOTIFY`**：Worker 处理一次 Pi 事件就 `NOTIFY agent_run_<runId>, <payload>`，API 对应连接上 `LISTEN` 同一个 channel，收到后原样转发给订阅的 SSE 客户端。选 `LISTEN`/`NOTIFY` 而不是别的：不引入 Redis（一贯原则），而且它是纯 pub/sub、不落任何行——这点比借用 Supabase Realtime 更合适，因为 Realtime 要求"有表变更才有通知"，逼着你为了拿到通知去写一行本不需要持久化的数据，正是 Question 里要避免的"token 级写入轰炸"。已知约束：`NOTIFY` payload 上限 8000 字节，token delta 通常几十字符没问题，但如果某个 `tool_execution_update` 想塞很大的中间输出，需要先截断/摘要再发，不能指望这条通道能扛大payload。

**落库时机**：不是"每个事件都写"也不是"攒到 turn 结束才写一次"这种二选一——这个问题在 [20 号](20-agent-pi-session-persistence-adapter.md) 已经有答案，21 号只是把它套进传输层：Pi 自己只在一条轮次**完整完成**时才产出 `SessionEntry`，Worker 收到就写一行 `agent_messages`（这就是"写"的唯一时机，不是攒批，是 Pi 自己天然只在完成时才给你东西写）。轮次进行中的 `message_update`/`tool_execution_update` 这类子事件根本不是 `SessionEntry`，只通过上面的 `NOTIFY` 转发给浏览器，从不进 Postgres——这不是"为了减少吞吐做的取舍"，是 Pi 自己的持久化粒度决定的，21 号不需要在这里做新的设计决策，只需要确认"实时转发的东西"和"落库的东西"是两个不同粒度的事件流，不能混为一谈。

**浏览器重连行为**（Canvas 和 Agent 两条通道保证级别不同，是刻意的）：Agent SSE 断线重连后，丢失的是"当前正在流式生成、还没完成的那部分" ——不补，浏览器等下一个完整 entry 或轮次结束即可；已完成的历史通过 `GET /api/threads/:threadId/messages` 读 `agent_messages` 拿到，不需要专门的"Agent gap 检测+catch-up API"。这和 Canvas 的 `canvas_deltas` + `afterVersion` 精确补漏（[ADR 0002](../../../docs/adr/0002-canvas-concurrency-and-realtime-sync.md)）保证级别不同，是刻意的——Canvas 的每一次几何/结构变化都是用户看得见摸得着的编辑历史，丢不起；Agent 流式输出的中间态本来就是"正在打字"的瞬时呈现，重新看一遍不影响任何东西。

**前端不做统一事件总线**：Canvas（Supabase Realtime 客户端）和 Agent 流（API 的 `EventSource`）是两种传输、两种重连/退避语义、两种保证级别，硬套进一个总线只是为了"看起来统一"而增加一层无意义的阻抗匹配。建议是两个独立的订阅 hook/store（比如 `useCanvasSync(canvasId)` / `useAgentRunStream(runId)`），各自把自己的事件形状归一化进应用状态，不共享同一条内部总线。这条是实现层面的倾向，不是硬约束，具体形状留给阶段二的前端契约 spec。
