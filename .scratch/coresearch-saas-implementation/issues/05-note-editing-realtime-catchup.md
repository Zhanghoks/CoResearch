# 05: Note 编辑 → DB → Realtime + Catch-up

**What to build:** 在画布上新建/移动/删除一个 `note` 类型节点，刷新页面后还在；开两个浏览器标签页，一边操作能在另一边通过 Supabase Realtime 看到同步；再故意制造一次 gap（比如断网重连），验证 `GET /api/canvases/:canvasId/deltas?afterVersion=N` 能补漏。这张顺带把 02 号还没做的 `MERGE_NODE_DATA`/`SET_NODE_GEOMETRY`/`SET_NODE_PARENT` 三条命令补进 `packages/engine`——只补这条切片真正用到的，不是补满 9 条。

**Blocked by:** 02（引擎核心）、04（需要能打开的画布）。

**Status:** ready-for-agent

- [ ] `POST /api/canvases/:canvasId/execute` 端到端跑通：`CREATE_NODES`（`note` 类型）、`SET_NODE_GEOMETRY`、`MERGE_NODE_DATA`、`DELETE_NODES`
- [ ] `pg_advisory_xact_lock(canvasId)` 生效，持锁范围只覆盖"读状态→执行命令→CAS 持久化→提交"这段（[ADR 0002](../../../docs/adr/0002-canvas-concurrency-and-realtime-sync.md)）
- [ ] 两个标签页验证 Realtime 同步：一边的操作几秒内出现在另一边
- [ ] 人为制造一次 `localVersion` 落后于 `fromVersion` 的 gap，验证前端会调 `GET .../deltas?afterVersion=N` 补齐再按序 replay，不是卡住或丢数据
- [ ] 刷新页面后节点状态与数据库一致（不是只存在于前端内存）
