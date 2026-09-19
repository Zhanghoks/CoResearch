# Postgres RLS 策略设计

Type: grilling
Status: open

## Question

`coresearch_app` 角色的行级隔离策略要怎么设计？以及一个容易漏想的地方：Supabase Realtime 订阅（[Canvas 实时同步策略](05-canvas-realtime-sync-strategy.md)决定要用）走的是订阅者自己的 JWT 身份，不是 `coresearch_app`——这意味着至少有两套需要分别设计、分别验证的 RLS 策略面：

1. `coresearch_app` 角色服务普通 API 请求时的策略（按 project 成员关系过滤）；
2. 认证用户直连 Realtime 订阅 `canvas_deltas` 时，Postgres 用该用户自己的角色/JWT claims 评估的策略。

两者是不是同一套策略定义、还是要写两遍？每张领域表（`research_entities` / `research_relations` / `canvas_state` / `canvas_projections` / `canvas_layout` / `canvas_deltas` / `usage_ledger` / `blobs`）分别需要什么策略？`projects` 表的成员关系（V1 是单人项目，但要不要现在就按"项目有成员表"设计，为将来协作留口子）？
