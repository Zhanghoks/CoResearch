# Step 泳道用轻量追加式布局，不用 Huabu 的结构化 Frame 求解器

- 状态：**superseded by [ADR 0010](./0010-restore-structured-frame-layout.md)**——删除/内容高度变化导致的碰撞重排，在 Research Projector 层手写会重新发明半个布局引擎，这条本文写的时候没考虑到。保留本文是为了记录"为什么一开始觉得不需要"，不要删除。

`docs/design/canvas/research-canvas.md` 的节点类型表写了 `Step 泳道 → frame, layout: 'column'`，字面暗示需要 Huabu 的 `column`/`row`/`grid` 结构化 Frame 求解器（`SET_FRAME_LAYOUT` + `autoLayout/gridLayout.ts`），但那套求解器已经被 [ticket 01](../../.scratch/coresearch-saas-architecture/issues/01-canvas-engine-command-set.md) 砍掉。V1 确认要保留"按 11 步 Research Flow 分栏"这个导航结构（项目创建时预先建好 N 个 `node_type='frame'` 的 Step 泳道容器，各自固定一段 x 区间，新实体按所属步骤 `parent_node_id` 挂进对应泳道），但不需要 reopen 01 号。

理由：Huabu 的结构化求解器解决的是"任意位置插入都要自动重排、拖拽时给实时预览"这类复杂交互（Kanban 式的中间插入挤开效果）。Step 泳道是 append-heavy 场景——新实体基本只追加到自己所属步骤的列尾，不需要处理"插进列中间要挤开别人"。投影器用简单的"取该泳道现有子节点 y 坐标的最大值 + 间距"就能算出新节点的初始位置。这条位置只是初始提示，不是强制约束——用户可以把节点拖出泳道、系统不会强制拉回去，延续"几何不定义语义"（[CONTEXT.md](../../CONTEXT.md)）的原则。

被拒绝的替代方案：reopen ticket 01，补回 `SET_FRAME_LAYOUT` 和结构化求解器。拒绝原因：Step 泳道的实际交互需求（append 到列尾）远比求解器要解决的问题（任意位置插入+拖拽预览+跨列移动重排）简单，为了一个不会被用到的能力重新引入 Huabu 文档里"极复杂"（`huabu-reverse-engineering.md` 原话）的一整套子系统，成本和收益不成比例。

配套的文档回写：`research-canvas.md` 的 `layout:'column'` 那一行在 [ticket 17](../../.scratch/coresearch-saas-architecture/issues/17-saas-architecture-doc-reconciliation.md) 回写时需要改写成"轻量追加式泳道，不是结构化求解器"，避免继续暗示需要 Huabu 的 solver。
