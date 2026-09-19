# Project 与 Canvas 的基数关系

Type: grilling
Status: resolved

## Question

CoResearch 是"一个项目一张画布"，还是要为将来的多画布场景（比如 Direction Deep Dive 开子画布）留出数据模型空间？这决定锁、Realtime channel、schema 主键怎么设计。

## Answer

数据模型从第一天允许一个 Project 拥有多个 Canvas（`canvas_projections` / `canvas_layout` / `canvas_deltas` / 写锁全部按 `canvas_id` 寻址），但 V1 产品上每个 Project 创建时只自动生成一个 primary Canvas，不提供创建/切换/管理多 Canvas 的 UI。Research Domain 是 project-scoped，不跟着 Canvas 变成 canvas-scoped——一个 Research Entity 不因为被投影到某个 Canvas 就属于那个 Canvas；`canvas_projections` 表解耦"语义对象"与"画布上的一份呈现"，未来同一个 Direction 可以被投影到多个 Canvas 而不复制实体。详见 [ADR 0003](../../../docs/adr/0003-project-canvas-cardinality.md)。
