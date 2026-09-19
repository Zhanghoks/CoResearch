# Supabase 作为托管基础设施，CoResearch API 保留为受信任领域运行时

- 状态：accepted

Huabu 的 canvas-engine 依赖过程式的执行语义（CAS 的 `'not-read'` 语义要求判断"本轮会话是否读过节点"、`preAssignIds`、逐条 `applied/reason` 回传、托管字段按函数入口而非参数拒绝写）——这些不是纯 SQL RLS 策略能自然表达的。我们选择 Supabase 只承担托管基础设施（Postgres、Auth、Storage、Realtime），业务逻辑继续跑在一个自建的 Node 服务（CoResearch API + Agent Worker）里，移植 Huabu 现成的 TypeScript 状态机，而不是把 canvas-engine 拆成 Postgres 函数 + RLS 策略 + Edge Function 的组合。

被拒绝的替代方案：浏览器直连 Supabase（`supabase-js`），业务逻辑全部写成 `plpgsql` 函数 + RLS + Edge Functions。拒绝原因除上述过程式逻辑难以表达外，Edge Functions 的执行时长限制也和 Agent 的多轮工具调用 + 流式输出模式冲突（见 canvas concurrency & realtime 的 ADR）。

一个直接推论：数据库身份必须拆成两类——`coresearch_app`（受 RLS 约束，服务普通请求）和 system/service role（仅供 projector、migration、system work，可绕过 RLS）。如果普通请求路径默认使用 `service_role`，RLS 这道防线形同虚设，"应用层 scope + RLS 两道锁"的纵深防御就只剩一道。这条必须在 CoResearch API 的数据库连接层就做死，不能留作约定。
