# Canvas 写锁粒度与实现

Type: grilling
Status: resolved

## Question

Huabu 原版 `write-coordinator.ts` 是 13 行进程内 promise 链，多实例部署下失效。换成什么？锁的粒度是 Project 还是 Canvas？要不要引入 Redis？

## Answer

用 Postgres 咨询事务锁（`pg_advisory_xact_lock`），按 `canvas_id` 哈希键，不是 `project_id`——因为 Research Domain 是 project-scoped 的语义边界，Canvas 才是并发边界，两者不能混。不引入 Redis：Supabase 托管的 Postgres 已经在架构里，多一个组件的成本比复用它更高。锁只覆盖"读当前状态 → 执行命令 → CAS 持久化 → 提交"这段短事务，绝不跨 LLM 调用或文献检索持有。`withCanvasMutex(canvasId)` 接口形状与 Huabu 原版一致，调用方无感。详见 [ADR 0002](../../../docs/adr/0002-canvas-concurrency-and-realtime-sync.md)。
