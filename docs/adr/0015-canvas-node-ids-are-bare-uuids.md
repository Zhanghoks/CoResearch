# Canvas 节点 id 全链路使用裸 uuid，不带 `node-` 前缀

- 状态：accepted

移植自 Huabu 的 `createId('node')`（`packages/shared/src/utils/id.ts`）返回的是 `` `node-${uuid}` `` 这种带类型前缀的字符串，[ticket 02](../../.scratch/coresearch-saas-implementation/issues/02-canvas-engine-core.md) 照抄时把这个形状一并带了进来，`preAssignIds` 的测试还断言了 `/^node-/`。但 [ADR 0008](./0008-canvas-canonical-storage-unified-nodes.md) 定下的 `canvas_nodes.id` 是 `uuid` 列，`'node-9f3c…'::uuid` 会直接抛 `22P02 invalid input syntax for type uuid`。这个冲突在阶段一/二的任何决策或 spec 里都没有被处理过，是实现 [ticket 05](../../.scratch/coresearch-saas-implementation/issues/05-note-editing-realtime-catchup.md) 时才暴露出来的。

**决策**：画布节点 id 在全链路上只有一种表示——裸 uuid。引擎侧 `preAssignIds` / `CREATE_NODES` 直接生成 uuid，不再加类型前缀；`canvas_nodes.id`、`canvas_layout.node_id`、`canvas_projections.node_id`、`canvas_edges` 的端点列、`canvas_deltas.deltas` jsonb 里嵌的 id、以及 `GET /api/canvases/:canvasId` 返回的 wire 形状，全部是同一个裸 uuid 字符串。

前缀在 Huabu 里是有意义的：Huabu 把画布状态存成 JSON 文件，id 是文件内的自由字符串，带上类型前缀能让人一眼认出这是节点还是边。CoResearch 把同一个 id 放进了带类型的 `uuid` 列、并且被四张表的外键引用，"这是什么类型的 id"由列和表本身表达，前缀不再购买任何东西，只剩下一个必须在每个持久化边界执行的转换。

被拒绝的替代方案一：**在持久化边界脱/加前缀**（引擎内部保持 `node-<uuid>`，写库前脱、读出来再加）。拒绝原因是它让两套约定长期共存，而且共存的位置特别危险——`canvas_deltas.deltas` 是 jsonb，里面嵌的是引擎产出的 id（带前缀），而 `canvas_nodes.id` 列是裸的。浏览器拿到一条 delta 去 `applyDeltas` 时，必须知道"delta 里的 id 和我从 `GET /api/canvases/:id` 拿到的 id 是不是同一套写法"。这是个会长期咬人的坑，省下的只是改几行引擎代码。

被拒绝的替代方案二：**把 `canvas_nodes.id` 改成 `text`**。拒绝原因是代价最大：`canvas_layout.node_id`、`canvas_projections.node_id`、`canvas_edges` 的端点列都是 `uuid`，要一起改，是一次动四张表的 migration；还会丢掉 `gen_random_uuid()` 默认值，以及 uuid 相对 text 的索引与存储优势。为了保留一个不再有用的前缀，不值得。

直接后果：ticket 02 里 `preAssignIds.test.ts` 那条 `/^node-/` 断言要改成断言 uuid 形状。那条断言测的是"我当时照抄了 Huabu 的 id 生成方式"这个实现选择，不是产品要求；它真正要守的不变量是"Agent 不能自带 id、必须由服务端分配"，改成裸 uuid 之后这条不变量完全不受影响。

再次触发这条决策的条件：出现需要在**不看列和表**的情况下从 id 字符串本身判断实体类型的场景（比如一个跨类型的全局 id 解析器，或者把多种 id 混在同一个 jsonb 数组里传输）。目前没有这种需求。
