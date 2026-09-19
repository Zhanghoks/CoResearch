# Schema 迁移与类型生成工具选择

Type: grilling
Status: resolved

## Question

Postgres schema 用什么方式管理：Supabase CLI 的原生 SQL migration（`supabase/migrations/`）+ `supabase gen types typescript` 生成类型，还是引入 ORM（Drizzle / Prisma）做 migration + 类型生成？这个选择会被 09（RLS 策略）间接影响（ORM 对手写 RLS 策略的迁移文件支持程度不同），但本身是独立可决定的工具选型问题，不阻塞其他 ticket。

## Answer

**Supabase CLI 原生 SQL migration + `supabase gen types typescript`，不引入 Drizzle/Prisma 当迁移工具。** 09 号定完之后，真实的 schema 需求清单已经出来了，可以不用假设直接看：`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`（几乎每张表）、`ALTER PUBLICATION supabase_realtime ADD TABLE canvas_deltas`（[ADR 0002](../../../docs/adr/0002-canvas-concurrency-and-realtime-sync.md) 的 Realtime 订阅要求）、partial unique index（[ticket 12](12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md) 的 `UNIQUE(project_id, source_candidate_id) WHERE ...`）、自引用外键（`canvas_nodes.parent_node_id`）、可能的 constraint trigger（[ticket 18](18-canvas-state-canonical-storage-model.md) 提到的 crEntity/projection 不变量，阶段二再评估）。这些都是 Supabase/Postgres 原生特性，Supabase CLI 的迁移文件就是期望你直接写的这类 SQL，零翻译成本。

**Drizzle/Prisma 会制造一个真实的分裂**：RLS 策略和 `ALTER PUBLICATION` 都不是 Prisma schema 能表达的一等公民（没有原生 RLS 支持，只能走 raw SQL migration hook），Drizzle 虽然有 `pgPolicy()` 这类较新的 RLS 支持，但发布配置（Realtime publication）仍然没有对应的 schema 原语——不管选哪个 ORM，RLS/publication 这部分迁移最终还是要单独用 Supabase CLI 或手写 SQL 跑一遍，等于同时维护两套迁移系统、两份 schema 真值（ORM 的 schema 文件 + 手写的 SQL 补丁），两边顺序错了或漂移了都难排查。这不是"哪个 ORM 更好用"的问题，是这批需求的形状本身就不适合被 ORM 的 migration 系统完整覆盖。

**类型生成和查询层分开决定**：`supabase gen types typescript` 生成的类型直接对应真实 schema（包括 RLS 覆盖的表），够用；查询代码写成薄的、手写参数化 SQL 的 repository 层（不是 ORM query builder）。如果后续查询代码变复杂想要更好的 DX，可以引入 Drizzle **只当 query builder**（用 `drizzle-kit introspect` 从已迁移好的真实数据库反向生成 `pgTable` 定义，Drizzle 不拥有 migration 权威），这条不影响本 ticket 的迁移工具结论，是独立的、可以后置的决定。

详见 [ADR 0014](../../../docs/adr/0014-schema-migration-tooling.md)。
