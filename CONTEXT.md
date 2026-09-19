# CoResearch SaaS

CoResearch 是一个研究画布 SaaS：用户从模糊的研究兴趣出发，经 [Research Flow](docs/design/research-flow.md) 的多步流程走到可版本化的 Idea。服务端引擎移植自 Huabu（`Huabu-main/`，microsoft/Huabu，MIT），改造为多租户；产品设计另见 `docs/design/`。这份文档管的是本次 SaaS 改装引入的架构术语——研究流程本身的领域词汇（Seed / Direction / Problem / Hypothesis / Idea 等）以 `docs/design/idea-structure.md` 与 `docs/design/research-flow.md` 为准，不在此重复定义。

## Language

**Project**:
用户的一个研究项目，Research Domain 的语义边界。一个用户可以拥有多个 Project。
_Avoid_: Workspace（Huabu 的说法，本仓库统一用 Project）

**Research Domain**:
一个 Project 范围内的研究状态图——Seed / Direction / Research Question / Problem / Hypothesis / Approach / Method / Evaluation / Idea 等实体及其 relations 的集合。是研究内容的唯一真值；不属于任何一个 Canvas。

**Canvas**:
一个 Project 下的画布运行时/并发边界——并发锁按 `canvas_id` 取（`pg_advisory_xact_lock`），Realtime 订阅按 `canvas_id` 开 channel。数据模型上 Project 可以拥有多个 Canvas，但 V1 每个 Project 只暴露一个 primary Canvas，不提供创建/切换/管理多 Canvas 的能力。Canvas 本身不持有研究内容的真值，只持有节点的布局与呈现——这一点和 Huabu 的 Space（`canvasId` 寻址、`space.json` + sidecar `.md` 即真值）不同：Huabu 的 Space 是内容+画布合一，CoResearch 的 Canvas 只是画布。
_Avoid_: Space（`docs/design/space.md` 已把这个词定义为 "Idea Meta Space"——一个由文献锚点、Idea 版本时间线组成的聚合视图，与画布无关。两者不能共用同一个词，本仓库的画布运行时边界一律叫 Canvas）

**Candidate**:
一个 Agent 提出的、尚未纳入研究空间的临时对象（Track A）——不进 `research_entities`，不产生 Canvas Projection，可以被自由丢弃。持久化位置是 `agent_messages` 的结构化 content part（`CandidatePart`，带服务端签发的稳定 `candidateId`），不是 Research Domain 的一部分。用户保存/拖拽的瞬间（"接受"）才同时创建 Research Entity、首条 revision、以及（如适用）首条 Canvas Projection——接受请求只携带 `candidateId` 与画布 placement，语义内容由服务端凭 id 回读，客户端不能携带/篡改。回答的问题是"这个对象要不要存在"。
_Avoid_: 把 Candidate 和 `confirmed:false` 的 Research Entity 混为一谈——Candidate 阶段根本不是一个 Research Entity；也不要用消息内位置（`messageId + index`）当 Candidate 的身份，流式生成/消息重排会让位置漂移。

**Proposal**:
对一个已存在的 Research Entity 提出的修改（Track B）。持久化对象，定义见 `docs/design/idea-structure.md` §3.1：带 `baseStateRevision`（防止基于旧版本改写）、`changes[]`（显式 diff）、`status: pending|accepted|rejected|superseded`。Proposal 从不产生 Canvas node，通过 Idea Meta Space 呈现给用户审阅；接受后应用 diff、目标实体 revision 递增。回答的问题是"这个已存在的对象要不要改"。
`Proposal.kind` 标的是"这条 Proposal 修改的语义区域"（`clarification`/`problem`/`hypothesis`/`revision`/`pivot`，未来会扩展到 `direction`/`approach`/`research_question`），不是"只有这几种 entity kind 能被提修改"——任何 entity kind 一旦物化，后续修改都统一走 Proposal。

**Canvas Node**:
`canvas_nodes` 表里的一行——覆盖所有节点类型，原生（`note`/`frame`/`pdf`/`question`/`web`）和 Research-managed（`crEntity`）共用同一张表、同一套身份与拓扑字段（`parent_node_id` 自引用，见 `SET_NODE_PARENT`）。这是移植自 Huabu 的共享 canvas-engine（`CREATE_NODES`/`SET_NODE_PARENT`/`normalizeTreeOrder` 等）对节点类型无感这条约束逼出来的：分两张表会让类型无关的执行器需要知道"这条命令该往哪张表插"。几何（位置/尺寸/pinned/collapsed）单独在 `canvas_layout` 表（身份/拓扑与几何是两个关注点，分开更干净，不是为了"缓存重建时存活"）。原生节点的内容（Note 正文等）存在 `native_data` 列；`crEntity` 节点的 `native_data` 最多装画布层批注，语义内容永远来自它绑定的 Research Entity，不允许在这里出现第二份真值。

**Canvas Projection**:
把一个 Research Entity 绑定到某个 `canvas_nodes` 行的 binding（`canvas_projections` 表：`node_id` 主键 ↔ `canvas_id` ↔ `entity_id`），不是一套独立于 `canvas_nodes` 的第二套节点清单——只有 `node_type = 'crEntity'` 的行有对应记录。解耦"语义对象"与"画布上的一份呈现"：未来同一个 Direction 可以被投影到多个 Canvas 而不复制实体。一个 Research Entity 在获得第一条 Canvas Projection 之前不算"存在"——它只是 Candidate，只存在于 Conversation；Entity、首条 revision、首条 Canvas Node（连带 Canvas Projection）在用户"接受"的瞬间同时创建（见 Candidate 词条、[ADR 0004](docs/adr/0004-candidate-vs-proposal-two-track-model.md)/[0005](docs/adr/0005-candidate-acceptance-transaction-shape.md)/[0008](docs/adr/0008-canvas-canonical-storage-unified-nodes.md)）。
`canvas_nodes` 本身就是权威存储，不是可丢弃重建的缓存——"`canvas_state`"这个整体快照的概念已经被 `canvas_nodes`/`canvas_edges`/`canvas_projections`/`canvas_deltas` 这套规范化表取代（[ADR 0008](docs/adr/0008-canvas-canonical-storage-unified-nodes.md)）。代表研究关系的边（两个 `crEntity` 节点之间）不持久化存储，是投影器渲染时从 `research_relations` × `canvas_projections` 计算出的虚拟边；`canvas_edges` 表只存不对应任何 `research_relations` 的纯画布连线。

**CoResearch API**:
承载 Huabu 移植过来的 canvas-engine / projector / ownership guard / research-service 的受信任 Node 运行时。所有触碰 Research Domain 或 Canvas 领域表的写入必须经过这一层；浏览器不能绕过它直接写。

**Agent Worker**:
与 CoResearch API 共享代码包，但生命周期与单次 HTTP 请求解耦的独立进程，跑 Agent 的 LLM 循环、文献检索、候选生成（Direction Exploration、Deep Dive 等长任务）。

**Supabase**（托管基础设施边界）:
提供 Postgres、Auth、Storage、Realtime 四项托管服务。浏览器允许直连的部分：Auth、Realtime（只读订阅）、Storage 的 signed URL。浏览器禁止直连的部分：任何 Research Domain 或 Canvas 领域表的写入——那些必须经过 CoResearch API。

**`coresearch_app`（DB 身份）**:
服务普通用户请求的数据库角色，受 Postgres RLS 约束，不能绕过。
_Avoid_: 把 `service_role` 当作普通请求路径的默认数据库身份——`service_role` 会绕过 RLS，只能用于 projector / migration / system work 这类系统路径。

**RequestContext**:
`{ userId, projectId, plan }`。Research Domain 操作（确认 Direction、更新 Problem、创建 Hypothesis）只需要这一层，不携带 canvas 信息。

**CanvasCommandContext**:
`RequestContext` 之外单独的类型，额外带 `canvasId`。只有 Canvas 命令（移动节点、缩放、连线、折叠）才需要它。两者不能混用同一个类型——这是从 Huabu 的 `getWorkspacePath()` / `getWorkspaceHandle()` 这类进程级全局上下文读取（多租户下必须消灭）演化出的显式、按请求传递的替代方案。
