# CoResearch SaaS：API 契约 Spec

来源：[决策地图](../../.scratch/coresearch-saas-architecture/map.md)，主要是 ADR 0001/0002/0004/0005/0006/0007/0012 与 ticket 12/14/19/21。拼装原则：每个端点标注它对应哪条决策，不新增行为。认证统一：`Authorization: Bearer <supabase-jwt>`，API 验证后构造 `RequestContext`（[CONTEXT.md](../../CONTEXT.md)）。

## 0. 浏览器允许绕过 API 直连的部分（[ADR 0001](../adr/0001-hybrid-backend-supabase-as-infra.md)）

- **Auth**：Supabase Auth 客户端（magic link + Google/GitHub OAuth），不经过 CoResearch API。
- **Canvas Realtime**：`supabase-js` 直接订阅 `canvas_deltas` 表（`.on('postgres_changes', {event:'INSERT', table:'canvas_deltas', filter:'canvas_id=eq.'+id}, ...)`），走 `authenticated` 角色 RLS（[ADR 0013](../adr/0013-rls-policy-pattern.md)）。
- **Storage**：signed URL 由 API 生成后交给浏览器直接 fetch，不是浏览器自己申请。

其余一切（下面列的端点）都经 CoResearch API，浏览器不直接查 Postgres。

## 1. Projects

| 方法/路径 | 决策来源 | 说明 |
|---|---|---|
| `POST /api/projects` | ADR 0013 | body `{title}`；同一事务插入 `projects` + `project_members`（owner）+ 一个 primary `canvases` 行（ADR 0003） |
| `GET /api/projects` | — | 当前用户所属的 project 列表 |
| `GET /api/projects/:projectId` | — | project 详情，含其 primary `canvasId` |

## 2. Research Domain

| 方法/路径 | 决策来源 | 说明 |
|---|---|---|
| `GET /api/projects/:projectId/research?kind=&status=` | ticket 14 `inspect_research_state` | entities + relations，Agent 工具和前端读同一个端点 |
| `GET /api/research-entities/:entityId` | — | 单实体详情（含 `research_entity_revisions` 历史） |
| `POST /api/projects/:projectId/candidates/:candidateId/accept` | [ticket 12](../../.scratch/coresearch-saas-architecture/issues/12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md)/[ADR 0005](../adr/0005-candidate-acceptance-transaction-shape.md) | body **只**带 `{canvasId, placement:{parentNodeId?, position:{x,y}}}`，不带语义内容——服务端凭 `candidateId`（= 发起候选的 `agent_messages.id`）回读。单事务：insert `research_entities` + 首条 `research_entity_revisions` + `CREATE_NODES` + insert `canvas_nodes`/`canvas_layout`/`canvas_projections` + bump `canvases.version` + insert `canvas_deltas`。幂等：命中 `UNIQUE(project_id, source_candidate_id)` 直接返回已存在的 `entityId`。 |
| `GET /api/projects/:projectId/proposals?status=pending` | ADR 0004 | 走 Idea Meta Space 审阅，不是 Canvas |
| `POST /api/proposals/:id/accept` | ADR 0004 | 校验 `baseStateRevision`，应用 `changes`，`research_entities.current_revision` 递增，若已有 Canvas Projection 只刷新渲染内容，不新建节点 |
| `POST /api/proposals/:id/reject` | ADR 0004 | 保留/归档，不改动目标实体 |

**永远不存在**（[ADR 0007](../adr/0007-agent-tool-set-drops-canvas-commands.md)/[ticket 14](../../.scratch/coresearch-saas-architecture/issues/14-agent-tool-write-permission-boundary.md)）：任何"Agent 直接创建/确认 Research Entity"的端点。Accept/Proposal-accept 只能由浏览器发起的、非 Agent 上下文的请求触发——这条在路由层就该体现为两个端点组不共享同一个内部服务函数入口（一个是 `executeFromRequest`，Agent 工具永远调不到它）。

## 3. Canvas

| 方法/路径 | 决策来源 | 说明 |
|---|---|---|
| `GET /api/canvases/:canvasId` | ADR 0008 | 初次加载：assemble `canvas_nodes` + `canvas_layout` + `canvas_edges` + `canvas_projections`（join `research_entities` 取当前语义内容）+ 计算虚拟关系边（`research_relations × canvas_projections`） |
| `POST /api/canvases/:canvasId/execute` | ticket 01/ADR 0010 | 命令批次（9 条：`CREATE_NODES`/`DELETE_NODES`/`MERGE_NODE_DATA`/`SET_NODE_GEOMETRY`/`SET_NODE_PARENT`/`CONNECT_NODES`/`DISCONNECT_EDGES`/`SET_NODE_SELECTION`/`SET_FRAME_LAYOUT`），`source:'ui'`；持有 `pg_advisory_xact_lock(canvasId)`（ADR 0002），逐条 `applied`/`reason` 回传，全拒即 no-op 不 bump 版本 |
| `GET /api/canvases/:canvasId/deltas?afterVersion=N` | ADR 0002 | durable catch-up，Realtime 掉线补漏用；不是浏览器的主路径（主路径是 Supabase Realtime） |

托管字段写入保护（ADR 0001 的所有权投影）在 `POST .../execute` 内部：`MERGE_NODE_DATA` 不能改 `crEntity` 节点绑定的 `research_entities` 语义字段，只能改 `canvas_nodes.native_data`（画布层批注）。

## 4. Agent Worker

| 方法/路径 | 决策来源 | 说明 |
|---|---|---|
| `POST /api/projects/:projectId/threads` | ADR 0011 | 建 `agent_threads`，`pi_cwd` 用 `projectId` 派生的稳定标识符 |
| `GET /api/threads/:threadId/messages` | ADR 0011 | 读 `agent_messages`，durable 历史（不含流式中间态） |
| `POST /api/threads/:threadId/runs` | ticket 19 | body `{prompt}`；插入 `agent_runs`（`status:'queued'`），Worker 轮询/claim |
| `GET /api/runs/:runId/stream` | [ADR 0012](../adr/0012-agent-stream-transport-separate-from-canvas-realtime.md) | SSE；API 端 `LISTEN agent_run_<runId>`，Worker 端每处理一次 Pi 事件 `NOTIFY`；只转发，不落库 |
| `POST /api/runs/:runId/cancel` | ticket 19 | `UPDATE agent_runs SET cancel_requested=true`；Worker 轮询发现后调 `session.abort()` |

**SSE 事件命名**（API 转发给浏览器的最终形状，和 Pi 内部事件名不是同一套——ADR 0012 的"事件经 adapter 转译，不直接暴露 Pi Event"）：

```text
run.started
message.started / message.delta / message.completed
tool.started / tool.updated / tool.completed
run.completed / run.failed / run.cancelled
```

**Agent 工具（不是 HTTP 端点，是 `defineTool()` 注册，Agent Worker 进程内调用；[ADR 0006](../adr/0006-agent-worker-pi-coding-agent-sdk.md)/[ticket 14](../../.scratch/coresearch-saas-architecture/issues/14-agent-tool-write-permission-boundary.md)）**：

```text
search_papers            只读，外部文献 API
read_paper                只读，scope 到 projectId
inspect_research_state    只读，等价于 GET /api/projects/:projectId/research
propose_candidates        写 agent_messages 的 CustomMessage(customType:'research_candidate')，不写 research_entities
propose_revision          写 proposals（status:'pending'），不写 canvas
ask_user                  无副作用
```

`execute()` 内部薄封装，直接调用和 HTTP 路径共享的同一套服务函数（`readResearchState()`/`proposeCandidate()`/`proposeRevision()`），不在 Worker 里另写一份权限检查。

## 5. 未决的端点细节（留给实现，不是本文档要拍板的）

- 分页参数（`GET .../research`、`GET .../messages` 这类列表端点的 `cursor`/`limit` 形状）
- 错误响应体的统一 schema（`{code, message, details}` 这类）
- Rate limit / quota 超限时的响应（原草稿 §1.7 提到 quota-guard，属于计费系统，这次不在阶段一/二范围内）
