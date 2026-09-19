# 07: Research-managed Node Ownership（V4）

**What to build:** 验证 Research 与 Canvas 的所有权边界本身，不依赖 Candidate 是 fixture 还是真实 Agent 产出——所以只 block 在 06 号（有了一个 `crEntity` 节点就够测）。对 06 号产出的节点直接发 `MERGE_NODE_DATA` 尝试改 `entityKind`/`status`/`confirmed` 这类托管字段，服务端拒绝且 `reason:'invalid-scope'`；改 `native_data`（画布层批注，比如 `userNote`）成功；手动制造一次 `research_entities` 的 revision 变化（不经 accept，直接更新数据库模拟"投影器刷新"），验证同一个 `nodeId` 的渲染内容更新、几何（`canvas_layout`）不变，没有新建节点。

**Blocked by:** 06（只需要 V3A，不需要 V3B——ownership 边界和 Candidate 的生产者是谁无关，这条本次会话里被明确纠正过：不要把它错误挂在 V3B 后面）。

**Status:** resolved

- [x] `MERGE_NODE_DATA` 改 `RESEARCH_OWNED_DATA_KEYS` 里的字段，返回 `applied:false, reason:'invalid-scope'`
- [x] `MERGE_NODE_DATA` 改 `native_data`（画布层批注）成功
- [x] `executeFromRequest()` 和 `executeAsProjector()` 是两个不同的函数导出，不是同一入口加参数——有一条测试直接调用 `executeFromRequest` 传一个伪造的 `source:'system'` 标签，验证依然被拒（因为判断依据是函数入口不是参数）
- [x] 模拟一次实体 revision 变化后，投影器刷新同一个 `nodeId` 的渲染内容，`canvas_layout`（用户几何）不受影响，没有产生第二个 `canvas_nodes` 行

## Answer

`packages/research` 补齐了 ownership 三函数，以及两个物理分开的入口：`executeFromRequest`（HTTP）和 `executeAsProjector`（投影器）。伪造 `source:'system'` 仍走 request 入口，owned keys → `invalid-scope`，host 不会被调用。`POST /execute` 对 `crEntity` 的 MERGE 先过 request 入口再进引擎。

`reconcileProjectionOnce` 用 `canvas_projections.projector_version !== research_entities.current_revision` 判断要不要刷新；刷新同一 `nodeId`，layout 原值写回，不 insert 第二行。再 plan 一次必须为空。PGlite：API 42/42，engine 16/16。
