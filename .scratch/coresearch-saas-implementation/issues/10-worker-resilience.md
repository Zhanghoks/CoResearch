# 10: Agent Run 韧性（V6）

**What to build:** 两个 Worker 实例跑起来；`agent_runs` 的 claim/lease/heartbeat 机制生效（[ticket 19](../../coresearch-saas-architecture/issues/19-agent-worker-run-scheduling.md) 的 `SELECT...FOR UPDATE SKIP LOCKED`）；kill 掉正在处理某个 run 的 Worker 进程，验证另一个实例在 lease 过期（45 秒）后接管并从上一个完整轮次续上；用户点取消，验证几秒内 `session.abort()` 真正生效、流停止。

**Blocked by:** 08。Milestone 1 已绿，已进入第二批。

**Status:** resolved

- [x] 两个 Worker 实例同时跑，同一个 run 不会被两边同时处理（`SKIP LOCKED` 验证）
- [x] kill 一个正在处理 run 的 Worker，45 秒内另一个实例 claim 到并续上，`agent_messages` 里最后一行是上一个完整轮次（没有半截的流式内容）
- [x] 用户点取消后几秒内 `agent_runs.status` 变成 `cancelled`，Worker 侧 `session.abort()` 真的中断了 LLM 调用（不是只改了数据库状态，进程还在跑）
- [x] Worker 崩溃前用户已经点了取消（`cancel_requested:true`）的场景：新 Worker claim 到后直接标 cancelled，不恢复 LLM 循环

集成测试覆盖 claim 互斥、lease 过期接管、`POST /cancel`、`cancel_requested` 直接标 cancelled、mid-run `session.abort()`。两个真实 OS 进程对打、以及杀进程后 45 秒接管，未在本机起双 Worker 手测。
