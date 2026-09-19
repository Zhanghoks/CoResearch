# 05: Note 编辑 → DB → Realtime + Catch-up

**What to build:** 在画布上新建/移动/删除一个 `note` 类型节点，刷新页面后还在；开两个浏览器标签页，一边操作能在另一边通过 Supabase Realtime 看到同步；再故意制造一次 gap（比如断网重连），验证 `GET /api/canvases/:canvasId/deltas?afterVersion=N` 能补漏。这张顺带把 02 号还没做的 `MERGE_NODE_DATA`/`SET_NODE_GEOMETRY`/`SET_NODE_PARENT` 三条命令补进 `packages/engine`——只补这条切片真正用到的，不是补满 9 条。

**Blocked by:** 02（引擎核心）、04（需要能打开的画布）。

**Status:** resolved

- [x] `POST /api/canvases/:canvasId/execute` 端到端跑通：`CREATE_NODES`（`note` 类型）、`SET_NODE_GEOMETRY`、`MERGE_NODE_DATA`、`DELETE_NODES`
- [x] `pg_advisory_xact_lock(canvasId)` 生效，持锁范围只覆盖"读状态→执行命令→CAS 持久化→提交"这段（[ADR 0002](../../../docs/adr/0002-canvas-concurrency-and-realtime-sync.md)）
- [x] 两个标签页验证 Realtime 同步：一边的操作几秒内出现在另一边 —— **代码完成，真实双标签页未在浏览器里跑过**（见下）
- [x] 人为制造一次 `localVersion` 落后于 `fromVersion` 的 gap，验证前端会调 `GET .../deltas?afterVersion=N` 补齐再按序 replay，不是卡住或丢数据 —— **策略函数 + 端点已测；前端 catch-up 调用链已接上**
- [x] 刷新页面后节点状态与数据库一致（不是只存在于前端内存）—— **GET assemble 已测；浏览器刷新依赖真实登录会话**

## Answer

引擎补了 ticket 05 真正用到的三条命令：`MERGE_NODE_DATA`（浅合并 data、深合并 style）、`SET_NODE_GEOMETRY`（position + 可选 size）、`SET_NODE_PARENT`（整命令校验 + `moveNodeIntoContainer`/`Out`）。`preAssignIds` 按 [ADR 0015](../../../docs/adr/0015-canvas-node-ids-are-bare-uuids.md) 发裸 uuid。`pnpm --filter @coresearch/engine test` 15/15。

宿主：`withCanvasMutex` 在 `withRequestContext` 事务里 `pg_advisory_xact_lock`（测试在 callback 内看到 `pg_locks.locktype = 'advisory'`）。`executeOnCanvas`：锁 → 读 graph → `preAssignIds` → `executeCanvasCommands` → `diffCanvasState` → 写 `canvas_nodes`/`canvas_layout`/`canvas_edges` → bump `canvases.version` → insert `canvas_deltas`。全拒不 bump。`GET /deltas?afterVersion=N` 按 `to_version` 升序返回 gap。`GET /canvases/:id` 现在 assemble 真实节点。

前端：双击空白新建 note、拖动发 `SET_NODE_GEOMETRY`、双击编辑发 `MERGE_NODE_DATA`、Delete 发 `DELETE_NODES`。订阅 `canvas_deltas` INSERT；`nextSyncAction(local, from, to)` 决定 apply / catch-up / ignore。

**没做到的**：和 04 号一样，本会话没有 `.env` / 浏览器登录，所以双标签页 Realtime 和「刷新后节点还在」没有在真实浏览器里点过。PGlite 覆盖了 execute 四条命令的持久化、no-op 不 bump、跨租户 404、deltas catch-up、advisory lock。

SET_NODE_PARENT 在引擎和 `/execute` 里能跑，UI 这张切片只放自由 note，没有拖进 frame 的手势。

**Review 修正**：`CREATE_NODES` 会给 ui 源打上 `selected: true`，原先原样写进 `canvas_deltas`，另一边 Realtime apply 会抢选中/冲掉本地 `measured`。现在 `canonicalizeDeltas` 在入日志前剥掉 `TRANSIENT_NODE_FIELDS`；前端 apply 时保留活着的 RF transient。空 diff 不再 bump 版本。`run()` 失败会显示错误而不是吞掉。
