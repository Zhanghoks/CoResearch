# CoResearch SaaS：架构与领域决策地图

**状态：阶段一已完成**（2026-09-19）。22 张 ticket 全部 resolved，22 条决策 + 14 份 ADR（含 1 条 supersede 链：0009→0010）。文档层面的一致性收口（17 号）也已完成。阶段二（DB schema / API 契约 / 引擎移植边界的实现级 spec）不在本地图里继续——按 wayfinder 惯例，走到头的地图不再追加新 ticket，阶段二是一个新的效果，起点是这里锁定的 22 条决策 + `CONTEXT.md` + `docs/adr/`。

## Destination

两阶段终点。**阶段一（本地图覆盖）**：把"把 Huabu 改装成 CoResearch SaaS"这件事里悬而未决的关键架构判断和领域判断一个个锁定——每个判断落在自己的 ticket 里，记录到经得起几个月后重新审视、或交给另一个 agent session 独立执行的程度（Context / Decision / Why / Alternatives / Consequences / Reopen conditions）。**阶段二**：阶段一锁定后，从决策毕业出实现级 spec ticket（数据库 schema、API 契约、引擎移植的具体文件边界），写完就能直接开工写代码——但阶段二的具体切分现在还不够 sharp，见 Fog。

范围边界：服务端 + "前端交互契约与 Canvas 接入边界"（Conversation→Candidate→Canvas 的协议、command/event/API contract），不含 UI 视觉细节、完整 UI 实现、计费、部署运维。本地图本身不写产品代码（除非某张 ticket 在自己的 body 里显式说明需要小型 throwaway prototype 来验证决策）。

## Notes

- 产品流程真值：[Research Flow](../../docs/design/research-flow.md)（11 步，Seed → Idea Versioning）；分步实现契约见 [Idea Formation](../../docs/design/idea-formation/README.md)；Idea 对象模型见 [idea-structure.md](../../docs/design/idea-structure.md)。
- 领域术语与本效果新造概念的边界：[CONTEXT.md](../../CONTEXT.md)（Project / Research Domain / Canvas / Canvas Projection / CoResearch API / Agent Worker / RequestContext / CanvasCommandContext）。
- 架构决策记录：[docs/adr/](../../docs/adr/)（0001 Supabase 混合架构、0002 Canvas 并发与实时同步、0003 Project:Canvas 基数、0004 Candidate/Proposal 两轨、0005 候选接受事务形状、0006 pi-coding-agent SDK 采用、0007 Agent 工具集去掉 canvas_commands、0008 Canvas 统一 `canvas_nodes`、0009 Step 泳道轻量布局【superseded by 0010】、0010 恢复结构化 Frame 布局、0011 `agent_messages` 直存 Pi SessionEntry、0012 Agent 流式传输独立于 Canvas Realtime、0013 RLS 策略模式、0014 Schema 迁移工具）。
- 技术栈：后端 Supabase（Postgres + Auth + Storage + Realtime，只当托管基础设施）+ 自建 Node 服务（CoResearch API + Agent Worker，承载 Huabu 移植过来的 canvas-engine）。V1 不引入 Redis。
- 源码出处：`Huabu-main/`（microsoft/Huabu，MIT）。直接复制的源码片段须保留版权与许可声明；只借架构决策的部分在文件头注明来源。
- 每个 ticket 解决时默认调用 grilling + domain-modeling 两个技能（除非 ticket 类型是 research/task，见各自的 Type 行）。
- **建议工作顺序**（非硬阻塞，按返工风险排的传播顺序）：18 → 13 → 22 → 20 → 19 → 21 → 09 → 10 → 17。Canvas 主线（18 定 schema 骨架 → 13/22 两张都是"要不要 reopen 01 号 frame solver"的分支，13 已确认不需要，22 还开着）先于 Agent 主线（20 定会话模型 → 19 才能定 resume 语义 → 21 才能干净拆分传输层）；两条主线都稳定后再做 09/10（RLS 和迁移工具需要真实的表集合，不该在表还漂移时定）；17（文档回写）放最后，因为前面每张都可能改动它要回写的内容。

**Hard Constraints**（跨所有 ticket 生效，不需要每次重新论证）：

1. Huabu 是 Canvas / interaction engine，CoResearch 是 research product/domain layer。
2. PostgreSQL 是 Research Domain 的 authoritative state。Canvas 是 interactive projection，不以几何位置定义语义。
3. Agent 输出默认是 proposed state。用户确认后才能成为 authoritative research state。
4. Conversation 是 Exploration Space。Canvas 是 Commitment Space。
5. Agent 推荐的 Direction Candidate 不自动进入 Canvas。
6. 用户 drag / accept 后，Candidate 才成为正式 Direction entity + Canvas projection（已验证；其余 entity kind 是否同一模式见 ticket 11）。
7. 用户可以保存多个 Direction，但只有显式选择某个 Direction 进行 Deep Dive 才进入下一阶段。
8. Direction Deep Dive 必须重建的不是 paper timeline，而是 Research Trajectory：Questions + Methods + Evaluation + Milestone Papers + Findings + Limitations + Branches + Current Frontier。
9. Research Question、Problem、Hypothesis、Approach、Method、Evaluation、Idea 是不同语义对象，不能压成一个 note。
10. Literature 中的 Method / Evaluation 与用户自己的 Method / Evaluation 必须区分。
11. Agent 不能把"当前搜索未发现直接工作"表述成"这是 confirmed gap / novelty"。
12. 所有 novelty / unresolvedness 判断都必须带时间和 provenance。
13. **A Candidate asks "should this object exist?"; a Proposal asks "should an existing object change?"**——两轨按操作语义区分，不按 entity kind 硬编码；同一个 entity kind 在不同时刻可能两轨都遇到。详见 [ADR 0004](../../docs/adr/0004-candidate-vs-proposal-two-track-model.md)。
14. **生产代码禁止直接调用 pi-coding-agent SDK 的 `createAgentSession()`**，一律经过 `createCoResearchAgentSession()` 工厂函数，内部写死研究领域工具白名单并断言暴露的工具集精确匹配（SDK 不传 `tools` 时默认启用 `read`/`bash`/`edit`/`write`，源码核实见 `sdk.ts:256`）。详见 [ADR 0006](../../docs/adr/0006-agent-worker-pi-coding-agent-sdk.md)。
15. **Frame containment 永远只是呈现层组织，从不隐含 Research Domain 语义**——`canvas_nodes.parent_node_id` 表达"摆在哪个容器里"，`research_relations` 才是语义关系的唯一真值源。拖一个节点进某个 Frame 不会改变它的 `entityKind`，也不会自动产生关系。详见 [ADR 0010](../../docs/adr/0010-restore-structured-frame-layout.md)。

## Decisions so far

- [Canvas 引擎移植边界与命令集裁剪](issues/01-canvas-engine-command-set.md)：纯函数执行器原样移植，命令集 17→8 条，砍结构化 Frame 求解器/自动边路由/sketch 节点等；**后被 [ADR 0010](../../docs/adr/0010-restore-structured-frame-layout.md) 部分 reopen，恢复 `SET_FRAME_LAYOUT`，命令集变 9 条**（其余裁剪不变）。
- [Supabase 混合架构角色划分与数据库身份边界](issues/02-supabase-hybrid-backend-role-split.md)：Supabase 只当基础设施，业务逻辑留在自建 CoResearch API；`coresearch_app`（受 RLS）vs system role（绕过 RLS）两类身份分开。
- [Agent Worker 与 CoResearch API 的进程边界](issues/03-agent-worker-process-boundary.md)：Agent Worker 与 API 共享包但生命周期解耦，不用 Edge Functions 跑 Agent Loop。
- [Canvas 写锁粒度与实现](issues/04-canvas-write-lock-granularity.md)：Postgres 咨询锁按 `canvas_id`，不引入 Redis，锁只覆盖短事务。
- [Canvas 实时同步策略](issues/05-canvas-realtime-sync-strategy.md)：Supabase Realtime 是快路径，`canvas_deltas` + `GET .../deltas?afterVersion=N` 是权威 catch-up 源。
- [认证方案](issues/06-auth-strategy.md)：Supabase Auth（magic link + Google/GitHub OAuth），JWT 验证后构造 `RequestContext`。
- [Project 与 Canvas 的基数关系](issues/07-project-canvas-cardinality.md)：schema 1 Project : N Canvas，V1 只暴露 1 个；Research Domain 保持 project-scoped。
- [领域术语消歧：Space vs Canvas](issues/08-space-canvas-terminology-disambiguation.md)：新概念改名 Canvas，避开 `docs/design/space.md` 已定稿的 "Idea Meta Space"。
- [论文 Canonicalization、Provenance 与 Freshness](issues/15-paper-canonicalization-provenance-freshness.md)：主力 Semantic Scholar + OpenAlex 兜底，Crossref 做 DOI 权威解析，arXiv 仅限预印本；以 DOI 为主键、arXiv ID 兜底，复用 S2/OpenAlex 的服务端去重；24 小时 freshness 重查窗口；V1 用量远低于免费额度，不需要现在规划付费层级。详见[调研报告](research/paper-canonicalization-provenance-freshness.md)（分支 `research/paper-canonicalization-provenance-freshness`）。
- [Research Entity 生命周期与 Agent-proposed/user-confirmed 状态模型](issues/11-research-entity-lifecycle-and-candidate-model.md)：两轨模型（Candidate 物化 / Proposal 修订）按操作语义区分，不按 entity kind 硬编码；`saved ≠ confirmed`；Proposal 从不产生 Canvas node，走 Idea Meta Space 审阅。详见 [ADR 0004](../../docs/adr/0004-candidate-vs-proposal-two-track-model.md)。
- [候选接受流程与 Canvas Projection 生命周期](issues/12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md)：`candidateId` 服务端签发、持久化在 `agent_messages`；accept 单事务+`UNIQUE(project_id, source_candidate_id)` 幂等；`canvas_state` = 原生拓扑 + Research-managed 投影；删节点≠删实体。详见 [ADR 0005](../../docs/adr/0005-candidate-acceptance-transaction-shape.md)。
- [Agent Worker 运行时迁移到 pi-coding-agent SDK](issues/16-agent-extension-architecture.md)：采用官方 `@earendil-works/pi-coding-agent`（核查通过，与 Huabu 已依赖的 `pi-agent-core`/`pi-ai` 同源同版本），替代 Agenetes 自研编排；自定义 `ResourceLoader` 关掉默认文件系统发现，必须显式传 `tools:[...]` 白名单（SDK 默认内置 `read`/`bash`/`edit`/`write`，漏传即安全漏洞），Postgres 为耐久真值，事件经 adapter 转译。详见 [ADR 0006](../../docs/adr/0006-agent-worker-pi-coding-agent-sdk.md)。
- [Agent 工具集与写入权限边界](issues/14-agent-tool-write-permission-boundary.md)：最终 6 工具（`search_papers`/`read_paper`/`inspect_research_state`/`propose_candidates`/`propose_revision`/`ask_user`），去掉 `canvas_commands`（[ADR 0007](../../docs/adr/0007-agent-tool-set-drops-canvas-commands.md)：两轨模型下 Agent 没有合法场景直接发画布命令）；`accept_*`/`archive_entity`/画布几何命令永远不注册成 Agent Tool；越权检查统一收口到服务层，Agent Worker 和 HTTP 路径复用同一套。
- [`canvas_state` 的规范存储形态](issues/18-canvas-state-canonical-storage-model.md)：`canvas_state` 整体快照概念被取代，统一 `canvas_nodes` 表覆盖原生+Research-managed 节点（身份/拓扑/`native_data`），`canvas_projections` 是 1:1 binding 不是平行节点体系；几何拆回独立的 `canvas_layout` 表（含 `frame_column`/`frame_row`，见 [ADR 0010](../../docs/adr/0010-restore-structured-frame-layout.md)）；研究关系边是投影器计算的虚拟边，不持久化。详见 [ADR 0008](../../docs/adr/0008-canvas-canonical-storage-unified-nodes.md)（更正 ADR 0005 的 `canvas_state` 措辞）。
- [Direction Deep Dive 数据模型](issues/13-direction-deep-dive-data-model.md)：Trajectory 子对象逐个归类（Phase/RQ/Method/Evaluation 是独立 entity kind，Milestone 是关系不是属性，Capabilities/Limitations/Branches 是 Phase 字段，Current Frontier 是查询不存储）；增量投影；**不需要 reopen 01 号**——Direction/Phase 用 `node_type='crEntity'` + `parent_node_id` 表达嵌套，不需要结构化 Frame 求解器。`research-canvas.md:153` 的 `layout:'column'` 实际说的是另一件事，拆到 [ticket 22](issues/22-step-swimlane-frame-layout.md)。
- [Step 泳道分栏布局](issues/22-step-swimlane-frame-layout.md)：V1 要分栏，**reopen 01 号恢复 `SET_FRAME_LAYOUT`**——删除中间节点的空隙压缩、内容变长后的下游让位，靠 Projector 手写等于重新发明半个布局引擎。Root Canvas 仍是自由画布，Step 泳道 Frame 内部用 `column, gridCount=1, hug`。`gridLayout.ts` 完整保留，V1 产品策略只暴露 `free`/`column`。原判断（轻量追加、不 reopen）见 [ADR 0009](../../docs/adr/0009-step-swimlane-lightweight-layout.md)，已被 [ADR 0010](../../docs/adr/0010-restore-structured-frame-layout.md) 推翻。
- [CoResearch 会话模型 ↔ Pi 持久化适配契约](issues/20-agent-pi-session-persistence-adapter.md)：`agent_messages` 直接存 Pi 的 `SessionEntry`，不发明独立会话 schema；`CandidatePart` 映射成 Pi 的 `CustomMessage`；`SessionManager.inMemory(cwd, opts, entries)` 直接用 Postgres 行还原运行时会话；Pi 自己"流式中间态不落盘"这条让 resume 边界白得，不用额外设计。详见 [ADR 0011](../../docs/adr/0011-agent-messages-store-pi-session-entries-directly.md)。
- [Agent Worker 调度机制](issues/19-agent-worker-run-scheduling.md)：Postgres `SELECT...FOR UPDATE SKIP LOCKED` 单条原子 claim（新排队+lease 过期的合并候选池）；心跳 15s/lease 45s；cancel 走 `cancel_requested` 轮询 + `session.abort()`；resume 无差别（复用 20 号的完整轮次边界），不按崩溃阶段分类。
- [Canvas Realtime 与 Agent 流式传输分离](issues/21-canvas-realtime-vs-agent-streaming-transport.md)：Agent 流走 API 自己的 SSE + Postgres `LISTEN`/`NOTIFY` 做 Worker→API 转发，不复用 Supabase Realtime（会强迫为通知写不该持久化的行）；两条通道保证级别刻意不同（Canvas 精确补漏，Agent 流式中间态丢了不补）；前端不强行统一事件总线。详见 [ADR 0012](../../docs/adr/0012-agent-stream-transport-separate-from-canvas-realtime.md)。
- [Postgres RLS 策略设计](issues/09-postgres-rls-policy-design.md)：`coresearch_app` 靠每请求事务级 `SET LOCAL app.current_user_id`（必须 LOCAL，否则连接池会跨请求泄漏身份）；Realtime 走 `authenticated` 角色 + `auth.uid()`；只有 `canvas_deltas` 两条策略都要，其余表只要 `coresearch_app` 一条；`project_members` 现在就建。详见 [ADR 0013](../../docs/adr/0013-rls-policy-pattern.md)。
- [Schema 迁移与类型生成工具选择](issues/10-schema-migration-tooling.md)：Supabase CLI 原生 SQL migration + `supabase gen types typescript`，不引入 Drizzle/Prisma 当迁移权威（RLS/Realtime publication 不是 ORM schema 的一等公民，会制造双重迁移系统）；查询层手写 repository，ORM query builder（如需要）后置且不拥有 migration。详见 [ADR 0014](../../docs/adr/0014-schema-migration-tooling.md)。
- [旧设计文档回写](issues/17-saas-architecture-doc-reconciliation.md)：`workspace.md`/`research-canvas.md`/`huabu-domain-binding.md`/`huabu-reverse-engineering.md` 逐段标注 `> **Superseded**` 并对齐 21 条决策，原文保留不删除；`docs/README.md`/`docs/design/README.md` 加架构真值优先级说明；全仓库扫过 `spaceId`/`space.json`/`GET /spaces/...` 残留。开放问题（skill 目录组织形态）留在文中标记，未开新 ticket。

## Not yet specified

- **阶段二 spec ticket 的具体切分**：目前只知道大方向是"DB schema / API 契约 / 引擎移植边界"三类，具体拆成几份文档、边界怎么画，要等阶段一（本地图）的 ticket 都毕业了才看得清。

## Out of scope

- **计费系统（Stripe / quota-guard / usage-ledger 的具体实现）**：Q2 范围裁剪时明确排除，属于下一个效果。
- **部署运维（容器编排、CI/CD、监控）**：同上，下一个效果。
- **UI 视觉细节与完整前端实现**：本地图只覆盖交互契约与 Canvas 接入边界，不覆盖具体组件/样式。
- **外部 CLI Agent / ACP / RFS**：V1 决策（见 `/Users/zmj/.claude/plans/huabu-saas-breezy-heron.md`），只保留内置 Agent，此方向不会重新打开除非产品方向改变。
- **多 Canvas 创建/切换/管理 UI**：schema 支持（见 [Project 与 Canvas 的基数关系](issues/07-project-canvas-cardinality.md)），但 V1 产品不做这层体验；重开条件见 [ADR 0003](../../docs/adr/0003-project-canvas-cardinality.md) 末尾。
- **多人协作 / 团队 Project**：已确认决策（个人账号单人项目），协作模型是完全不同的效果，不在本地图讨论范围。
