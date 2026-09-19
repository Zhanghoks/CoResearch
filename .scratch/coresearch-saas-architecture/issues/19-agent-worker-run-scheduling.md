# Agent Worker 调度机制：claim / lease / heartbeat / cancel / resume

Type: grilling
Status: resolved

## Question

从地图 Fog 毕业（[ticket 03](03-agent-worker-process-boundary.md) 定了 Worker 和 API 进程解耦，但没定怎么调度）。以 [ADR 0006](../../../docs/adr/0006-agent-worker-pi-coding-agent-sdk.md) 的 "Postgres 是耐久真值、`SessionManager.inMemory()` 是运行时状态" 为前提，需要钉死：

- Worker 怎么 claim 一个 `agent_run`：V1 不引入 Redis，Postgres `SELECT ... FOR UPDATE SKIP LOCKED` 式的队列是不是够用？
- Worker 崩溃后 lease 怎么超时、谁来把 run 标回可认领——`agent_runs` 表要不要 `lease_owner`/`lease_expires_at`/`heartbeat_at` 这几个字段，心跳周期多长合适（要短到能及时发现崩溃，又不能让心跳写入本身成为高频负载）？
- 并发保护：同一个 `run` 会不会被两个 Worker 同时执行（`SKIP LOCKED` 本身应该能防这个，但要不要额外的幂等保护，类似 [ticket 12](12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md) 那套唯一约束思路）？
- Cancel 怎么从浏览器传到正在执行的 Worker——轮询 `agent_runs.status`，还是 Postgres `LISTEN/NOTIFY`，还是别的？
- Worker 重启后哪些 run 能 resume：所有 in-flight run 都尝试恢复，还是只有特定状态（比如工具调用之间的边界）能安全恢复，其他直接标失败让用户重新触发？

## Answer

**Claim**：单条原子 UPDATE，把"新排队的 run"和"lease 过期的 running run"（崩溃恢复）合进同一个候选池，`SELECT ... FOR UPDATE SKIP LOCKED` 保证并发 claim 不冲突，不需要额外的唯一约束当第二道防线（不像 [ticket 12](12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md) 的 accept——那里幂等性是防"同一个用户操作被重复提交"，这里 `SKIP LOCKED` 本身就是并发原语，两个 Worker 不可能拿到同一行的锁）：

```sql
UPDATE agent_runs
SET status = 'running', lease_owner = $worker_id,
    lease_expires_at = now() + interval '45 seconds',
    heartbeat_at = now(), started_at = coalesce(started_at, now())
WHERE id = (
  SELECT id FROM agent_runs
  WHERE status = 'queued'
     OR (status = 'running' AND lease_expires_at < now())
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
RETURNING *;
```

**Lease/心跳**：`lease_expires_at`/`heartbeat_at`/`lease_owner` 三个字段。心跳周期 15 秒，lease 时长 45 秒（3 倍心跳间隔，容忍一两次心跳丢失不误判崩溃，但 Worker 真崩溃后最多 45 秒被别的 Worker 接管）——这个比例是通用做法，不是精确计算出来的，先用，真出问题再调。心跳只是一次 `UPDATE agent_runs SET heartbeat_at=now(), lease_expires_at=now()+45s WHERE id=$run_id AND lease_owner=$worker_id`，单行主键更新，不是高频负载。

**Cancel**：浏览器调 `POST /api/runs/:runId/cancel` → API 直接 `UPDATE agent_runs SET cancel_requested=true`（快速返回，不等 Worker 响应）。Worker 在工具调用之间/轮次之间的自然边界轮询 `cancel_requested`（轻量的主键查询，可以用比心跳更短的周期，比如 2 秒，不需要 `LISTEN/NOTIFY`——几秒的取消延迟可接受，不值得为此加一层通知机制），发现为 true 就调 Pi SDK 的 `session.abort()`（[ADR 0006](../../../docs/adr/0006-agent-worker-pi-coding-agent-sdk.md) 已核实这个方法存在）并把 `agent_runs.status` 标成 `'cancelled'`。

**Resume**：直接复用 [ticket 20](20-agent-pi-session-persistence-adapter.md) 已经定的边界——Pi 自己只在一条轮次**完整完成**后才产出持久化 entry，崩溃时未完成的那部分从未落库。所以**所有** `running` 状态、lease 过期的 run 都可以无差别尝试 resume，不需要按"崩在哪个阶段"分类处理：新 Worker claim 到这个 run 后，`SELECT agent_messages WHERE thread_id=? ORDER BY id` 重建 `SessionManager.inMemory(...)`，天然从上一个完整轮次续上。唯一需要在 resume 时优先检查的：如果 `cancel_requested` 已经是 true（用户在原 Worker 崩溃前点了取消，但还没来得及处理），新 Worker 直接标 `cancelled`，不要恢复 LLM 循环。

**Schema**：

```sql
agent_runs (
  id,
  thread_id references agent_threads(id),
  project_id,               -- 冗余存一份，RLS 按 project 过滤不用多 join agent_threads
  status,                   -- 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  lease_owner nullable,      -- worker 实例标识
  lease_expires_at nullable,
  heartbeat_at nullable,
  cancel_requested boolean default false,
  created_at, started_at nullable, ended_at nullable
)
```

不加 `last_entry_id` 之类的续传水位字段——[ticket 20](20-agent-pi-session-persistence-adapter.md) 的重建算法本来就是"读这个 thread 的全部 entries"，不需要额外维护一个水位指针去优化这次查询，thread 的 entry 数量级不会大到需要这层优化。
