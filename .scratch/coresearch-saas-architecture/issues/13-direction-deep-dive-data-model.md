# Direction Deep Dive 数据模型

Type: grilling
Status: resolved
Blocked by: 11

## Question

`docs/design/research-flow.md` 第 3 节称 Direction Deep Dive 是"CoResearch 最重要的中间阶段之一"，要重建的不是论文时间线而是 **Research Trajectory**：Questions + Methods + Evaluation + Milestone Papers + Findings + Limitations + Branches + Current Frontier。

以 [Research Entity 生命周期](11-research-entity-lifecycle-and-candidate-model.md) 定下的实体模式为前提，需要确定：
- Research Trajectory 的这几个子对象（Milestone Papers / Findings / Limitations / Branches / Current Frontier）哪些是独立的 Research Entity kind，哪些只是某个 entity 的字段或聚合视图；
- Deep Dive 的结果怎样"逐步投影到 Canvas"（用户原话）——是一次性生成还是增量流式追加节点；
- Direction Frame 下的 Phase Frames / Papers / Research Questions / Methods / Evaluation 这套"同一张无限画布内展开"的结构，Canvas Projection 表要不要支持"节点属于另一个节点的 Frame"这种父子关系（Huabu 原生支持 `SET_NODE_PARENT`，需要确认沿用）。
- **要不要 reopen [ticket 01](01-canvas-engine-command-set.md) 砍掉的结构化 Frame 求解器**：见 Answer——结论是不需要，`research-canvas.md:153` 的 `layout:'column'` 说的是另一件事（见 [ticket 22](22-step-swimlane-frame-layout.md)），不是 Deep Dive 自己的需求。

## Answer

**实体模型**：`docs/design/canvas/huabu-reverse-engineering.md` §10.3 原来就把 `phase` 列进了 15 种 `entityKind` 之一，不用新造。Trajectory 的子对象逐个归类：

| 子对象 | 归类 | 理由 |
|---|---|---|
| Phase | 独立 Research Entity kind（`phase`） | 已在原有 entityKind 枚举里；有自己的 revision/confirmed/status，且 [4 号步骤](../../../docs/design/research-flow.md) 的 Research Question 要能从某个 Phase 追溯来源 |
| Research Question | 独立 Research Entity kind（`question`，已有） | Deep Dive 发现的 RQ **就是** 后面 [Research Question Selection](../../../docs/design/research-flow.md) 步骤要选的那些 RQ，不是 Phase 内部的私有字段——同一个实体贯穿两个步骤，Deep Dive 只是它的产生来源之一 |
| Method Families / Evaluation Paradigms | 独立 Research Entity kind（`method`/`evaluation`，已有），`origin: 'literature'` | Hard Constraint 10 已经要求"Literature 的 Method/Evaluation 与用户自己的 Method/Evaluation 必须区分"——这暗示两者最终是同一 kind 的不同 `origin`，不是两套并行概念；[8 号步骤 Method & Evaluation Co-Design](../../../docs/design/research-flow.md) 产出 `origin:'user'`/`'system'` 的版本时，能直接引用/对比这里 `origin:'literature'` 的版本 |
| Milestone Papers | 不是新 kind，是 `research_relations` 的一条关系（`milestone_of`，Paper → Phase/Direction） | Paper 是独立于 `research_entities` 的另一套概念（[ticket 15](15-paper-canonicalization-provenance-freshness.md) 的 DOI/arXiv 规范化对象，规范存储在自己的 `papers` 表，不在 `research_entities` 里）；"是不是 milestone"是一个关系上下文里的标注，不是论文自身的属性 |
| Capabilities / Limitations | Phase 实体 payload 里的结构化字段（bullet 列表），不是独立 kind | 后续步骤没有把"某条 Limitation"当独立可追溯/可确认对象引用的场景 |
| Branches | Phase 上的分组字段（`branch_id`/`sequence_index`），不是独立 kind | 表达"研究脉络不是一条直线"只需要 Phase 之间的前驱/分支关系，不需要额外实体 |
| Current Frontier | 不存储，是查询（"没有后继 Phase 的叶子 Phase"） | 和 Huabu `research/views/` 的"聚合视图不手工维护、可重新生成"原则一致——存了就要操心和 Phase 数据不同步 |

**增量投影，不是一次性生成**：Agent 在 Deep Dive 这个长任务里逐个 Phase 提案（每个 Phase 连带它的 RQ/Method/Evaluation 候选，一起打包成一批 [Track A Candidate](11-research-entity-lifecycle-and-candidate-model.md)），用户能看着 Dossier 逐步成形，不用等整个多分钟的检索跑完才看到第一条结果——这条呼应 Hard Constraint 3（"Agent 输出默认是 proposed state"）和 [ticket 21](21-canvas-realtime-vs-agent-streaming-transport.md) 的流式传输。

**Frame 结构不需要 reopen 01 号**：`research-flow.md` 自己给的画布建议（`Direction=Frame, Phase=Frame`）画出来是纵向序列（Phase 1→RQ→Phase 2→RQ→Current Frontier），用 [ticket 18](18-canvas-state-canonical-storage-model.md) 刚定的统一 `canvas_nodes` + `parent_node_id` 就够表达父子嵌套，不需要 Huabu 的 `column`/`row`/`grid` 结构化求解器。`node_type='frame'`（[ADR 0008](../../../docs/adr/0008-canvas-canonical-storage-unified-nodes.md) 保留的原生类型）不用在 Direction/Phase 身上——**它们的画布投影仍然是 `node_type='crEntity'`**（`entityKind` 是 `direction`/`phase`），前端渲染层按 `entityKind` 决定要不要画成带边框的容器视觉（呼应 `huabu-node-presentation-and-links.md` 的"一个节点类型 + 语义缩放"原则），不需要为此新造一个 schema 层面的 frame 类型。文档里"多轨并排"那张图（RQ/Methods/Evaluation/Papers 按时间对齐的泳道）更像是 Dossier 的专用可视化组件，读的是 Phase 序列的结构化数据直接渲染图表，不是用户在自由画布上手动拖放的结构，不需要画布命令支持。

需要在阶段二单独定的（不在本 ticket 范围内，先记录）：`papers` 表的规范 schema（[ticket 15](15-paper-canonicalization-provenance-freshness.md) 只做了外部 API 调研，没定 schema）。

**待复查（[ADR 0010](../../../docs/adr/0010-restore-structured-frame-layout.md) 重开结构化 Frame 后带出的潜在张力）**：Huabu 的 `SET_FRAME_LAYOUT` 处理器要求目标节点 `node_type==='frame'`（源码核实：`frame.type !== 'frame'` 直接 `noop`）。本 ticket 判定 Direction/Phase 用 `node_type='crEntity'`，如果 Phase 的子节点（Milestone Papers/RQ）将来也出现类似 Step 泳道那样的"频繁增删导致空隙、内容变长导致让位"问题，`crEntity` 类型的 Phase 节点没法直接用 `SET_FRAME_LAYOUT` 重排自己的子节点——这条本 ticket 判定时没考虑到，先记录，等 Deep Dive 的实际使用频率/交互模式在阶段二明确后再决定要不要处理（比如：Phase 内容对比 Step 泳道天然增删更少，可能确实不需要；或者需要给 crEntity 节点也开放结构化布局能力，这会是对 Huabu 引擎的一处真实修改，不是简单复用）。
