# CoResearch SaaS：架构与领域决策地图

## Destination

两阶段终点。**阶段一（本地图覆盖）**：把"把 Huabu 改装成 CoResearch SaaS"这件事里悬而未决的关键架构判断和领域判断一个个锁定——每个判断落在自己的 ticket 里，记录到经得起几个月后重新审视、或交给另一个 agent session 独立执行的程度（Context / Decision / Why / Alternatives / Consequences / Reopen conditions）。**阶段二**：阶段一锁定后，从决策毕业出实现级 spec ticket（数据库 schema、API 契约、引擎移植的具体文件边界），写完就能直接开工写代码——但阶段二的具体切分现在还不够 sharp，见 Fog。

范围边界：服务端 + "前端交互契约与 Canvas 接入边界"（Conversation→Candidate→Canvas 的协议、command/event/API contract），不含 UI 视觉细节、完整 UI 实现、计费、部署运维。本地图本身不写产品代码（除非某张 ticket 在自己的 body 里显式说明需要小型 throwaway prototype 来验证决策）。

## Notes

- 产品流程真值：[Research Flow](../../docs/design/research-flow.md)（11 步，Seed → Idea Versioning）；分步实现契约见 [Idea Formation](../../docs/design/idea-formation/README.md)；Idea 对象模型见 [idea-structure.md](../../docs/design/idea-structure.md)。
- 领域术语与本效果新造概念的边界：[CONTEXT.md](../../CONTEXT.md)（Project / Research Domain / Canvas / Canvas Projection / CoResearch API / Agent Worker / RequestContext / CanvasCommandContext）。
- 架构决策记录：[docs/adr/](../../docs/adr/)（0001 Supabase 混合架构、0002 Canvas 并发与实时同步、0003 Project:Canvas 基数、0004 Candidate/Proposal 两轨、0005 候选接受事务形状、0006 pi-coding-agent SDK 采用、0007 Agent 工具集去掉 canvas_commands）。
- 技术栈：后端 Supabase（Postgres + Auth + Storage + Realtime，只当托管基础设施）+ 自建 Node 服务（CoResearch API + Agent Worker，承载 Huabu 移植过来的 canvas-engine）。V1 不引入 Redis。
- 源码出处：`Huabu-main/`（microsoft/Huabu，MIT）。直接复制的源码片段须保留版权与许可声明；只借架构决策的部分在文件头注明来源。
- 每个 ticket 解决时默认调用 grilling + domain-modeling 两个技能（除非 ticket 类型是 research/task，见各自的 Type 行）。

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

## Decisions so far

- [Canvas 引擎移植边界与命令集裁剪](issues/01-canvas-engine-command-set.md)：纯函数执行器原样移植，命令集 17→8 条，砍结构化 Frame 求解器/自动边路由/sketch 节点等。
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

## Not yet specified

- **阶段二 spec ticket 的具体切分**：目前只知道大方向是"DB schema / API 契约 / 引擎移植边界"三类，具体拆成几份文档、边界怎么画，要等阶段一（本地图）的 ticket 都毕业了才看得清。

## Out of scope

- **计费系统（Stripe / quota-guard / usage-ledger 的具体实现）**：Q2 范围裁剪时明确排除，属于下一个效果。
- **部署运维（容器编排、CI/CD、监控）**：同上，下一个效果。
- **UI 视觉细节与完整前端实现**：本地图只覆盖交互契约与 Canvas 接入边界，不覆盖具体组件/样式。
- **外部 CLI Agent / ACP / RFS**：V1 决策（见 `/Users/zmj/.claude/plans/huabu-saas-breezy-heron.md`），只保留内置 Agent，此方向不会重新打开除非产品方向改变。
- **多 Canvas 创建/切换/管理 UI**：schema 支持（见 [Project 与 Canvas 的基数关系](issues/07-project-canvas-cardinality.md)），但 V1 产品不做这层体验；重开条件见 [ADR 0003](../../docs/adr/0003-project-canvas-cardinality.md) 末尾。
- **多人协作 / 团队 Project**：已确认决策（个人账号单人项目），协作模型是完全不同的效果，不在本地图讨论范围。
