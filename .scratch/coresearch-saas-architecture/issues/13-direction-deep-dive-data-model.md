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
