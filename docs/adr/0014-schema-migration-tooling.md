# Schema 迁移用 Supabase CLI 原生 SQL，不引入 Drizzle/Prisma 当迁移工具

- 状态：accepted

[ticket 09](../../.scratch/coresearch-saas-architecture/issues/09-postgres-rls-policy-design.md) 定完 RLS 策略后，真实的 schema 需求清单已经出来：`ENABLE ROW LEVEL SECURITY`/`CREATE POLICY`（几乎每张表）、`ALTER PUBLICATION supabase_realtime ADD TABLE canvas_deltas`（[ADR 0002](./0002-canvas-concurrency-and-realtime-sync.md)）、partial unique index（[ADR 0005](./0005-candidate-acceptance-transaction-shape.md)）、自引用外键（[ADR 0008](./0008-canvas-canonical-storage-unified-nodes.md)）、可能的 constraint trigger（阶段二）。这批需求几乎全是 Supabase/Postgres 原生特性，不是 Prisma schema 或 Drizzle schema 能完整表达的一等公民——Prisma 没有原生 RLS 支持，Drizzle 的 `pgPolicy()` 相对新且不覆盖 Realtime publication 配置。不管选哪个 ORM，RLS/publication 这部分迁移最终还是要单独用 Supabase CLI 或手写 SQL 跑一遍，等于同时维护两套迁移系统、两份 schema 真值，顺序错了或漂移了难排查。

**决策**：schema 迁移用 Supabase CLI 的原生 SQL migration（`supabase/migrations/`），类型生成用 `supabase gen types typescript`。查询层写成薄的、手写参数化 SQL 的 repository 函数，不引入 ORM query builder。如果后续查询代码复杂度上升，可以引入 Drizzle **只当 query builder**（用 `drizzle-kit introspect` 从已迁移好的数据库反向生成 `pgTable` 定义，不让它拥有 migration 权威）——这条不改变本决策，是独立的、可以后置的选择。

被拒绝的替代方案：Drizzle 或 Prisma 作为迁移权威。拒绝原因见上——这批需求的形状本身不适合被 ORM 的 migration 系统完整覆盖，会制造双重迁移系统的真实分裂风险，不是"哪个 ORM 更好用"层面的取舍。
