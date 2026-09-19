# Step 泳道（11 步 Research Flow 按栏分布）要不要结构化 Frame 布局

Type: grilling
Status: resolved

## Question

`docs/design/canvas/research-canvas.md:153` 的节点类型表里有一行 `Step 泳道 → frame, layout: 'column'`——这指的是**整个 11 步 Research Flow 在画布上按步骤分栏**（Seed 一栏、Direction 一栏、Problem 一栏……），和 [13 号](13-direction-deep-dive-data-model.md) 的 Direction Deep Dive Phase 结构是两件不同的事（13 号已经确认 Deep Dive 自己不需要结构化布局）。

这条 `layout: 'column'` 暗示要用 Huabu 的结构化 Frame 求解器（`SET_FRAME_LAYOUT` + column/row/grid solver，[ticket 01](01-canvas-engine-command-set.md) 已经砍掉），需要确定：

- V1 的整体画布要不要有"按步骤分栏"这个结构化组织，还是每一步产出的实体就近投影在已有内容旁边，让用户自己决定空间组织（更符合"研究画布用户自由探索"的产品调性，但导航体验会弱一些）？
- 如果要分栏：是不是真的需要 Huabu 那种"节点掉进某一列会自动重新排布同列其他节点"的结构化求解器，还是投影器给新实体计算一个"大致在哪一栏"的初始位置就够，用户可以自由挪动（不需要 solver，只需要投影器的初始位置算法更聪明一点）？后者不需要 reopen 01 号，前者需要。
- 如果确定不需要结构化分栏，`research-canvas.md:153` 这一行要在 [ticket 17](17-saas-architecture-doc-reconciliation.md) 回写时删掉或改写。

这张独立于 13 号，互不阻塞。

## Answer

**修订**（原 Answer 判断"轻量追加+不 reopen 01 号"，被 [ADR 0010](../../../docs/adr/0010-restore-structured-frame-layout.md) 推翻，理由见该 ADR——原判断漏想了删除中间节点后的空隙压缩、节点高度随 revision 变化后的下游让位这两个真实场景，[ADR 0009](../../../docs/adr/0009-step-swimlane-lightweight-layout.md) 已标记 superseded，本文保留原判断供参考）：

**要分栏，且 reopen 01 号恢复 `SET_FRAME_LAYOUT`。** 项目创建时投影器预先建好 N 个 `node_type='frame'` 的 Step 泳道容器（[ADR 0008](../../../docs/adr/0008-canvas-canonical-storage-unified-nodes.md) 的统一 `canvas_nodes`），固定横向初始位置（Seed x=0、Direction x=500……），**Root Canvas 本身仍是自由画布**——不要把整张画布塞进一个大 structured Frame，否则用户失去无限画布的自由度。每个 Step 泳道 Frame 内部用 `layoutMode='column', gridCount=1, sizing='hug'`，子节点纵向堆叠、碰撞重排、高度变化后的让位全部交给共享引擎批次末尾的结构化重排 pass，Research Projector 不用算任何具体坐标。

12 号 accept 流程因此更省事：客户端只传 `placement: { parentNodeId: <目标 Frame 的 node id> }`，不需要算精确 y 坐标。

**Hard Rule**：Frame containment 永远只是呈现层组织，不隐含 Research Domain 语义——拖进某个 Frame 不会改变 `entityKind`，也不会自动产生 `research_relations`。这条已并入 map.md Notes。

`research-canvas.md:153` 的 `layout:'column'` 在 [ticket 17](17-saas-architecture-doc-reconciliation.md) 回写时基本不用改（原描述反而是对的），只需要去掉"V1 已裁掉这个能力"的暗示（因为现在确实没裁）。

详见 [ADR 0010](../../../docs/adr/0010-restore-structured-frame-layout.md)。
