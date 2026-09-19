# Supabase 混合架构角色划分与数据库身份边界

Type: grilling
Status: resolved

## Question

后端用 Supabase：它是全部后端（浏览器直连 + RLS + Edge Functions），还是只当基础设施（自建 Node API 承载业务逻辑）？普通用户请求的数据库身份该用什么？

## Answer

Supabase 只当托管基础设施（Postgres/Auth/Storage/Realtime）；Huabu 移植过来的 canvas-engine、projector、ownership guard、research-service 继续作为受信任的自建 Node 服务（CoResearch API）跑，所有 domain mutation 必经此层，浏览器不能绕过直接写 research/canvas 领域表。数据库身份拆两类：`coresearch_app`（受 RLS 约束，服务普通请求）vs system/service role（仅供 projector/migration/system work，绕过 RLS）——`service_role` 绝不能是普通请求路径的默认身份，否则"应用层 scope + RLS 两道锁"只剩一道。详见 [ADR 0001](../../../docs/adr/0001-hybrid-backend-supabase-as-infra.md)。
