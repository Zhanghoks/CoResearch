# Project 与 Canvas 是一对多，V1 只暴露其中一个

- 状态：accepted

数据模型从第一天就允许一个 Project 拥有多个 Canvas（`canvas_projections` / `canvas_layout` / `canvas_deltas` / 写锁全部按 `canvas_id` 而非 `project_id` 寻址），但 V1 的产品逻辑保证每个 Project 创建时自动生成且仅生成一个 primary Canvas，不提供创建 / 删除 / 切换 Canvas 的 UI。Research Flow 的 0–6 步（Seed 到 Hypothesis）全部发生在这一个 Canvas 上，包括 Direction Deep Dive——不把"我想深入某个 Direction"解释成"系统应该开一张新画布"，那是信息空间展开的需求，不是页面/画布分裂的需求。

这条决策的直接后果是 Research Domain 必须是 project-scoped，不能跟着 Canvas 变成 canvas-scoped：一个 Research Entity（比如某个 Direction）不因为被投影到某个 Canvas 就属于那个 Canvas，它属于 Project；`canvas_projections` 表存的是"这个实体在这个 Canvas 上有一个投影"，不是复制一份实体。这样将来真的要给某个 Direction 的 Deep Dive 开一张独立 Canvas 时（比如主 Canvas 因为几百篇论文和大量 method/evaluation 对比而变得不可读），同一个 Direction 可以同时在两个 Canvas 上各有一条投影，而不需要数据迁移或实体复制。

被拒绝的替代方案：把 Project 和 Canvas 焊成一对一（`docs/design/canvas/huabu-reverse-engineering.md` 原草稿"V1 一个项目一张画布"的字面写法）。拒绝原因是这会把"将来支持多 Canvas"变成一次要动 schema 主键的破坏性迁移，而现在按 `canvas_id` 建表的成本和一对一方案几乎相同——多花的只是多一张 `canvas_projections` 映射表，不是多一层产品复杂度。

再次触发这条决策的条件：出现真实需求要在同一个 Project 下同时维护多张可见 Canvas（不是现在就要做，只是记录判断这条决策该不该重开的信号）。
