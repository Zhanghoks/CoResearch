# Agent Worker 调度机制：claim / lease / heartbeat / cancel / resume

Type: grilling
Status: open

## Question

从地图 Fog 毕业（[ticket 03](03-agent-worker-process-boundary.md) 定了 Worker 和 API 进程解耦，但没定怎么调度）。以 [ADR 0006](../../../docs/adr/0006-agent-worker-pi-coding-agent-sdk.md) 的 "Postgres 是耐久真值、`SessionManager.inMemory()` 是运行时状态" 为前提，需要钉死：

- Worker 怎么 claim 一个 `agent_run`：V1 不引入 Redis，Postgres `SELECT ... FOR UPDATE SKIP LOCKED` 式的队列是不是够用？
- Worker 崩溃后 lease 怎么超时、谁来把 run 标回可认领——`agent_runs` 表要不要 `lease_owner`/`lease_expires_at`/`heartbeat_at` 这几个字段，心跳周期多长合适（要短到能及时发现崩溃，又不能让心跳写入本身成为高频负载）？
- 并发保护：同一个 `run` 会不会被两个 Worker 同时执行（`SKIP LOCKED` 本身应该能防这个，但要不要额外的幂等保护，类似 [ticket 12](12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md) 那套唯一约束思路）？
- Cancel 怎么从浏览器传到正在执行的 Worker——轮询 `agent_runs.status`，还是 Postgres `LISTEN/NOTIFY`，还是别的？
- Worker 重启后哪些 run 能 resume：所有 in-flight run 都尝试恢复，还是只有特定状态（比如工具调用之间的边界）能安全恢复，其他直接标失败让用户重新触发？
