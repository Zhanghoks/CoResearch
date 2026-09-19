# 03: RequestContext + RLS

**What to build:** `withRequestContext(ctx, fn)` 包装函数（每个 `coresearch_app` 请求的事务里先 `SET LOCAL app.current_user_id`，见 [ADR 0013](../../../docs/adr/0013-rls-policy-pattern.md)），01 号建的全部表 `ENABLE ROW LEVEL SECURITY` + 对应策略，`canvas_deltas` 额外的 `authenticated`/`auth.uid()` Realtime 订阅策略 + `ALTER PUBLICATION supabase_realtime ADD TABLE canvas_deltas`。必须有一条测试证明跨 Project 越权查询真的被拦——不是"策略写了就当验证过"。

**Blocked by:** 01。

**Status:** resolved

- [x] `withRequestContext()` 强制所有 `coresearch_app` 查询经过它，不允许裸连接池查询（生产代码层面不可绕过，不是约定）
- [x] 每张表的 `coresearch_app` 策略生效（[docs/spec/01-database-schema.md](../../../docs/spec/01-database-schema.md) 各表的 `CREATE POLICY`）
- [x] `canvas_deltas` 的 `authenticated` 策略 + publication 配置生效
- [x] 测试：用户 A 的 `RequestContext` 查询用户 B 的 project 数据，返回空/被拒，不是意外的跨租户读取
- [x] `service_role` 路径（projector/migration）不受这些策略影响，有一条测试证明

## Answer

`apps/api/src/db/withRequestContext.ts`：事务里先 `SET LOCAL ROLE coresearch_app`（登录角色 GRANTed 这个 NOLOGIN 角色，否则会话停在 BYPASSRLS 的 postgres 上，策略全是空转），再 `SELECT set_config('app.current_user_id', $1, true)`。池子不导出。生产代码只能拿到 `RequestDb`。`src/db/` 以外 import `pg` 会被测试拦住。`withServiceRole` 走另一条连接、不 SET ROLE、不 set session 变量。

`00000000000002_rls.sql` 建 `coresearch_app`、15 张表 ENABLE+FORCE RLS、每张一条 `coresearch_app` 策略；`canvas_deltas` 额外 `authenticated`/`auth.uid()` + `ALTER PUBLICATION supabase_realtime ADD TABLE canvas_deltas`。已应用到托管项目 `bpxlnucpdmunyvwjpjov`（每表 RLS+FORCE，`canvas_deltas` 两条策略，publication 含该表）。

**和 spec 的出入**（都是拼装 SQL 的实现修正，不是新架构判断）：
- spec §1 的 `project_members` 策略带一条指向自己的 OR 子查询 → 42P17 无限递归。SELECT 改成 `user_id = current_setting(...)`；INSERT 限制为该 project 的 owner，避免任意用户把自己写进别人的 `project_id`。
- `projects` 从 FOR ALL 拆成 SELECT/INSERT/UPDATE/DELETE，否则创建 project 时 INSERT 会要求一条还不存在的 membership 行。
- `authenticated` 策略不能直接 JOIN `canvases`/`project_members`（这两张表 FORCE RLS 且没有 `TO authenticated` 策略，子查询永远空）。改成 owner 的 `SECURITY DEFINER` 函数 `canvas_visible_to_auth`，浏览器仍然只 GRANT `canvas_deltas`。

测试：PGlite 上跑真实 RLS（用户 A 只能看到自己的 project；超级用户路径能看到全部）+ `withRequestContext` 断言走 `set_config(..., true)` 而不是裸 `SET`。`pnpm --filter @coresearch/api test` 6/6。
