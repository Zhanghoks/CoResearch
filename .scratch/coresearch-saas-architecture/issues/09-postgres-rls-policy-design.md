# Postgres RLS 策略设计

Type: grilling
Status: resolved

## Question

`coresearch_app` 角色的行级隔离策略要怎么设计？以及一个容易漏想的地方：Supabase Realtime 订阅（[Canvas 实时同步策略](05-canvas-realtime-sync-strategy.md)决定要用）走的是订阅者自己的 JWT 身份，不是 `coresearch_app`——这意味着至少有两套需要分别设计、分别验证的 RLS 策略面：

1. `coresearch_app` 角色服务普通 API 请求时的策略（按 project 成员关系过滤）；
2. 认证用户直连 Realtime 订阅 `canvas_deltas` 时，Postgres 用该用户自己的角色/JWT claims 评估的策略。

两者是不是同一套策略定义、还是要写两遍？每张领域表（`research_entities` / `research_relations` / `canvas_state` / `canvas_projections` / `canvas_layout` / `canvas_deltas` / `usage_ledger` / `blobs`）分别需要什么策略？`projects` 表的成员关系（V1 是单人项目，但要不要现在就按"项目有成员表"设计，为将来协作留口子）？

## Answer

**两套策略必须分开写，且作用在不同角色上**——不是同一份定义复用两次。`coresearch_app` 是 API 服务器共享连接池用的单一角色，没有"每个 SaaS 用户一个 Postgres 角色"这回事，所以它的策略不能直接用 `auth.uid()`（那是 Supabase 给认证用户 JWT 准备的），必须靠**每个请求的事务里显式 `SET LOCAL` 一个 session 变量**告诉 Postgres "这次请求是谁"：

```sql
-- 每个请求处理函数的第一件事（在同一个事务里）
SET LOCAL app.current_user_id = '<uuid>';

-- 策略引用这个变量
CREATE POLICY coresearch_app_project_scope ON research_entities
  FOR ALL TO coresearch_app
  USING (project_id IN (
    SELECT project_id FROM project_members
    WHERE user_id = current_setting('app.current_user_id')::uuid
  ));
```

**必须是 `SET LOCAL` 不是 `SET`**——这条是硬约束，不是随口一提：连接池会复用连接给下一个请求，`SET`（非 LOCAL）设置的值会跨请求泄漏，等于让 A 用户的请求在 B 用户的身份下跑，是一个真实的跨租户越权漏洞，不是理论风险。跟 [ADR 0006](../../../docs/adr/0006-agent-worker-pi-coding-agent-sdk.md) 的 fail-closed 工厂函数同一个思路：**不允许任何代码路径绕过这层直接拿连接池连接去查表**，必须统一经过一个 `withRequestContext(ctx, fn)` 包装函数，内部负责开事务、`SET LOCAL`、跑查询、提交，散落各处的裸查询代码不可能"忘记设置"。

**Realtime 订阅走 Supabase 内置的 `authenticated` 角色**，不是 `coresearch_app`——这是 Supabase 自己的机制：浏览器用 JWT 连 Realtime 时，Postgres 端用 `authenticated` 角色求值 RLS，`auth.uid()`（Supabase 提供的内置函数）自动从 JWT claims 里取用户 id，不需要我们自己 `SET` 任何东西：

```sql
CREATE POLICY authenticated_realtime_scope ON canvas_deltas
  FOR SELECT TO authenticated
  USING (canvas_id IN (
    SELECT c.id FROM canvases c
    JOIN project_members pm ON pm.project_id = c.project_id
    WHERE pm.user_id = auth.uid()
  ));
```

**只有 `canvas_deltas` 需要这条 `authenticated` 策略，其余表都不需要**——核对了每张表浏览器会不会直接碰它：浏览器只通过 Supabase Realtime **订阅** `canvas_deltas`（[ADR 0002](../../../docs/adr/0002-canvas-concurrency-and-realtime-sync.md)），Realtime 订阅本身要求订阅角色满足该表的 RLS SELECT 权限（即使 catch-up 走的是 API 端点不是直接查表，订阅动作本身仍然要过这道policy）；Agent 流式（[ADR 0012](../../../docs/adr/0012-agent-stream-transport-separate-from-canvas-realtime.md)）走的是 API 自己的 SSE，完全不碰 Supabase Realtime；Research Domain 和其余 Canvas 表（`canvas_nodes`/`canvas_layout`/`canvas_edges`/`canvas_projections`）浏览器都是经 CoResearch API 读写，不直连（[ADR 0001](../../../docs/adr/0001-hybrid-backend-supabase-as-infra.md)）；Storage 走签名 URL，由 API 生成，浏览器不需要直接查 `blobs` 元数据表。所以：**`research_entities`/`research_entity_revisions`/`research_relations`/`proposals`/`projects`/`project_members`/`canvases`/`canvas_nodes`/`canvas_layout`/`canvas_edges`/`canvas_projections`/`agent_threads`/`agent_messages`/`agent_runs`/`papers`/`usage_ledger`/`blobs` 只需要 `coresearch_app` 一条策略；只有 `canvas_deltas` 额外多一条 `authenticated` 策略。**

**`project_members` 现在就建**（回答 Question 里"要不要为协作留口子"）：即使 V1 每个 project 只在创建时自动插入一行（owner 自己），后面所有表的策略都要 `JOIN project_members` 而不是直接比对 `owner_id`——现在建这张表和以后加协作时把每张表的策略从"比 owner_id"改成"查成员表"相比，成本差得多，跟 [ADR 0003](../../../docs/adr/0003-project-canvas-cardinality.md) "schema 现在就支持未来的基数，V1 只是不激活"是同一个原则。

**`service_role`（系统路径）不需要写策略**——Supabase 的 `service_role` 天生 `BYPASSRLS`，这是 Postgres/Supabase 自己的机制保证的，不是我们要额外配置的东西；投影器、migration 走这条路径时不受上面任何策略约束，这也是为什么 [ADR 0001](../../../docs/adr/0001-hybrid-backend-supabase-as-infra.md) 要求它绝不能成为普通请求路径的默认身份。

详见 [ADR 0013](../../../docs/adr/0013-rls-policy-pattern.md)。
