# Canvas 实时同步策略

Type: grilling
Status: resolved

## Question

Huabu 原版是进程内 `Map<canvasId, Set<Listener>>` + 自建 SSE。多实例下换成什么？Supabase Realtime 能不能直接当权威同步机制？

## Answer

用 Supabase Realtime 订阅 `canvas_deltas` 表按 `canvas_id` 过滤的 INSERT 事件，取代自建 SSE。但 Realtime 只是通知快路径，不是权威 replay log——客户端不能假设自己永远不会漏事件（连接抖动、重连窗口）。必须同时提供 `GET /spaces/:canvasId/deltas?afterVersion=N` 作为 durable catch-up 源；`canvas_deltas` 表本身才是真正的持久来源。前端 `applyDeltas` + 版本门控（`localVersion >= toVersion` 跳过）逻辑不变，只是事件来源换了。详见 [ADR 0002](../../../docs/adr/0002-canvas-concurrency-and-realtime-sync.md)。
