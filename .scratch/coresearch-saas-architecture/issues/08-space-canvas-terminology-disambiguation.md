# 领域术语消歧：Space vs Canvas

Type: grilling
Status: resolved

## Question

架构会话里新造的"画布运行时/并发边界"概念叫什么？`docs/design/space.md` 已经把"Space"定义成了"Idea Meta Space"（文献锚点+Idea 版本时间线的聚合视图），跟画布无关。两个概念不能共用一个词。

## Answer

新概念改名为 Canvas（`canvas_id` / `canvas_projections` / `withCanvasMutex(canvasId)`），直接对齐 Huabu 原有的 `canvasId` 术语，不动 `docs/design/space.md` 里已经跨多篇文档引用的 "Idea Meta Space"。完整术语表见 [CONTEXT.md](../../../CONTEXT.md)。
