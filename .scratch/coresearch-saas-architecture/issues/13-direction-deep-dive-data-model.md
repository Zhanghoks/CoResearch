# Direction Deep Dive 数据模型

Type: grilling
Status: open
Blocked by: 11

## Question

`docs/design/research-flow.md` 第 3 节称 Direction Deep Dive 是"CoResearch 最重要的中间阶段之一"，要重建的不是论文时间线而是 **Research Trajectory**：Questions + Methods + Evaluation + Milestone Papers + Findings + Limitations + Branches + Current Frontier。

以 [Research Entity 生命周期](11-research-entity-lifecycle-and-candidate-model.md) 定下的实体模式为前提，需要确定：
- Research Trajectory 的这几个子对象（Milestone Papers / Findings / Limitations / Branches / Current Frontier）哪些是独立的 Research Entity kind，哪些只是某个 entity 的字段或聚合视图；
- Deep Dive 的结果怎样"逐步投影到 Canvas"（用户原话）——是一次性生成还是增量流式追加节点；
- Direction Frame 下的 Phase Frames / Papers / Research Questions / Methods / Evaluation 这套"同一张无限画布内展开"的结构，Canvas Projection 表要不要支持"节点属于另一个节点的 Frame"这种父子关系（Huabu 原生支持 `SET_NODE_PARENT`，需要确认沿用）。
- **要不要 reopen [ticket 01](01-canvas-engine-command-set.md) 砍掉的结构化 Frame 求解器**：`research-canvas.md:153` 写的是 `Step 泳道 → frame, layout: 'column'`，暗示 Huabu 的 `column`/`row`/`grid` 结构化 Frame 布局（`SET_FRAME_LAYOUT` + solver）还在用；但 01 号已经决定砍掉它，V1 只留普通自由 Frame + 用户手动布局。这个矛盾要在这里解决，不能两边都对：如果 Deep Dive 的 Phase Frames 确实需要结构化布局（用户拖进一个 Phase、其他节点自动让位），01 号要重开补回 `SET_FRAME_LAYOUT`；如果 Deep Dive 也能用"普通 Frame + 投影器计算初始位置 + 用户自由调整"打发，01 号的裁剪维持不变，只需要把 `research-canvas.md` 里 `layout: 'column'` 的描述删掉（并入 [ticket 17](17-saas-architecture-doc-reconciliation.md) 的回写范围）。不要为了命令数量好看而裁能力，要从这里的产品需要反推。
