# 03: RequestContext + RLS

**What to build:** `withRequestContext(ctx, fn)` 包装函数（每个 `coresearch_app` 请求的事务里先 `SET LOCAL app.current_user_id`，见 [ADR 0013](../../../docs/adr/0013-rls-policy-pattern.md)），01 号建的全部表 `ENABLE ROW LEVEL SECURITY` + 对应策略，`canvas_deltas` 额外的 `authenticated`/`auth.uid()` Realtime 订阅策略 + `ALTER PUBLICATION supabase_realtime ADD TABLE canvas_deltas`。必须有一条测试证明跨 Project 越权查询真的被拦——不是"策略写了就当验证过"。

**Blocked by:** 01。

**Status:** ready-for-agent

- [ ] `withRequestContext()` 强制所有 `coresearch_app` 查询经过它，不允许裸连接池查询（生产代码层面不可绕过，不是约定）
- [ ] 每张表的 `coresearch_app` 策略生效（[docs/spec/01-database-schema.md](../../../docs/spec/01-database-schema.md) 各表的 `CREATE POLICY`）
- [ ] `canvas_deltas` 的 `authenticated` 策略 + publication 配置生效
- [ ] 测试：用户 A 的 `RequestContext` 查询用户 B 的 project 数据，返回空/被拒，不是意外的跨租户读取
- [ ] `service_role` 路径（projector/migration）不受这些策略影响，有一条测试证明
