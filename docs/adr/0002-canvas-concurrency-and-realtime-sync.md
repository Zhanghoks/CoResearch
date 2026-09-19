# Canvas 写锁用 Postgres 咨询锁，Realtime 是快路径而非权威源

- 状态：accepted

**写锁**：Huabu 原版 `write-coordinator.ts` 是 13 行进程内 promise 链，多实例部署下失效。我们没有为此引入 Redis，而是用 Postgres 咨询事务锁（`pg_advisory_xact_lock`，按 `canvas_id` 哈希键，不是 `project_id`）——Supabase 托管的 Postgres 已经在架构里，多一个组件的成本比复用它更高。锁只覆盖"读当前状态 → 执行命令 → CAS 持久化 → 提交"这段几十毫秒级的事务，绝不跨 Agent 的 LLM 调用或文献检索持有——那些阶段先跑完、形成 command batch，再进临界区。`withCanvasMutex(canvasId)` 的调用方接口形状和 Huabu 原版一致，内部实现从进程内换成跨实例的数据库锁。

被拒绝的替代方案：Redis 分布式锁（Redlock 或单 Redis）。V1 明确不引入 Redis，等出现 Postgres 咨询锁确实不够用的负载（高吞吐 job queue、跨区域协调）再考虑。

**实时同步**：Supabase Realtime 订阅 `canvas_deltas` 表按 `canvas_id` 过滤的 INSERT 事件，取代 Huabu 原版 `Map<canvasId, Set<Listener>>` + 自建 SSE。但 Realtime 只是通知快路径，不是权威的 replay log——客户端不能假设自己永远不会漏事件（连接抖动、重连期间的窗口）。因此必须同时提供 `GET /api/canvases/:canvasId/deltas?afterVersion=N` 作为 durable catch-up 源；客户端发现本地 `localVersion` 与收到的事件 `fromVersion` 之间有 gap 时，从这个端点补齐再按序 replay。`canvas_deltas` 表本身才是真正的持久来源，Realtime 只是它的一个订阅通道。
