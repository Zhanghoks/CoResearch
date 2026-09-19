# RLS 策略模式：`coresearch_app` 靠事务级 session 变量，`authenticated` 靠 `auth.uid()`，只有 `canvas_deltas` 两者都要

- 状态：accepted

[ADR 0001](./0001-hybrid-backend-supabase-as-infra.md) 定了 `coresearch_app`（受 RLS 约束）和 `service_role`（绕过 RLS，仅系统路径）两类数据库身份，但没定 `coresearch_app` 的策略具体怎么写。问题在于 `coresearch_app` 是 API 服务器共享连接池用的单一 Postgres 角色——不存在"每个 SaaS 用户一个 Postgres 角色"这回事，所以它的 RLS 策略不能像 Supabase 常见教程那样直接用 `auth.uid()`（那是 Supabase 给持有 JWT 的 `authenticated` 角色准备的内置函数，`coresearch_app` 的连接从不携带终端用户的 JWT）。

**决策**：`coresearch_app` 的每个请求，在处理该请求的数据库事务开始时执行 `SET LOCAL app.current_user_id = '<uuid>'`，策略引用 `current_setting('app.current_user_id')::uuid` 并 `JOIN project_members` 判断成员关系。**必须是 `SET LOCAL` 不是 `SET`**——连接池会把同一条物理连接复用给下一个请求，`SET`（非 LOCAL）设置的值跨事务持续存在，会让后一个请求在前一个请求的用户身份下跑，是真实的跨租户越权，不是理论风险。这条比"用哪种 ORM"更底层，必须结构性地保证：所有 `coresearch_app` 查询经过统一的 `withRequestContext(ctx, fn)` 包装（开事务 → `SET LOCAL` → 跑查询 → 提交），代码里不允许出现绕过这层直接用连接池连接查表的路径——同 [ADR 0006](./0006-agent-worker-pi-coding-agent-sdk.md) fail-closed 工厂函数的思路，不能靠"记得写"。

Supabase Realtime 订阅走的是 `authenticated` 角色，机制完全不同：浏览器带 JWT 连接时，Postgres 端自动用 `auth.uid()` 取用户 id，不需要应用层做任何 `SET` 动作。这意味着**同一张表如果浏览器要直接订阅，必须写两条策略**（一条 `TO coresearch_app USING (... current_setting ...)`，一条 `TO authenticated USING (... auth.uid() ...)`），不是同一份定义复用两次。

逐表核对后，只有 **`canvas_deltas`** 需要 `authenticated` 策略——它是浏览器唯一直接通过 Supabase Realtime 订阅的表（[ADR 0002](./0002-canvas-concurrency-and-realtime-sync.md)）。Agent 流式传输不碰 Realtime（[ADR 0012](./0012-agent-stream-transport-separate-from-canvas-realtime.md)）；Research Domain 和其余 Canvas 表、Storage 元数据都只经 CoResearch API 读写（[ADR 0001](./0001-hybrid-backend-supabase-as-infra.md)）。其余每张表只需要 `coresearch_app` 一条策略。

顺带决定：`project_members` 表现在就建，即使 V1 每个 project 创建时只插入一行（owner）——所有策略都 `JOIN project_members` 而不是比对 `projects.owner_id`，成本和 [ADR 0003](./0003-project-canvas-cardinality.md) "schema 现在就支持未来基数、V1 不激活"是同一笔账：现在建表零成本，以后把每张表的策略从"比 owner_id"改写成"查成员表"是真实的迁移工作量。`service_role` 不需要写策略——`BYPASSRLS` 是 Supabase/Postgres 自己保证的，这也是它绝不能成为普通请求路径默认身份的原因。

被拒绝的替代方案：`coresearch_app` 策略写成 `USING (true)`（权限判断完全交给应用层，RLS 只是摆设）。拒绝原因：这就退化成只有一道防线，直接违反 [ADR 0001](./0001-hybrid-backend-supabase-as-infra.md) 已经定的"应用层 scope + RLS 两道锁"——那条决策的全部意义就是让 RLS 在应用层出 bug 时仍然拦得住。
