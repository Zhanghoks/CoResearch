# CoResearch 设计文档

本仓库的产品设计入口。`web/` 是画布原型；这里是已拍板的产品与领域设计。

**架构真值优先级**：SaaS 化改装（多租户、Supabase、Postgres Research Domain）之后，[CONTEXT.md](../CONTEXT.md)、决策地图 [`.scratch/coresearch-saas-architecture/map.md`](../.scratch/coresearch-saas-architecture/map.md) 和 [docs/adr/](./adr/) 是架构层面的最新真值。下面列的产品/领域设计文档里，[Workspace](./design/workspace.md) 和 [研究画布](./design/canvas/research-canvas.md) 部分内容已被取代（文中标了 `> **Superseded**` 的段落），领域流程（Research Flow、Idea Formation、Idea 结构）本身不受影响。

## 先读

1. [Research Flow](./design/research-flow.md) — **产品流程真值**。从模糊兴趣到可版本化 Idea，以及 Conversation / Canvas 两条通道。
2. [Idea Formation](./design/idea-formation/README.md) — 各步实现级契约（输入输出、Gate、revision）。与 Flow 冲突时以 Flow 为准。
3. [研究画布](./design/canvas/research-canvas.md) — Canvas 架构、命令模型、与 Huabu 的取舍。**存储/传输部分已被 SaaS 架构地图取代，见文中 Superseded 标注**。
4. [Workspace](./design/workspace.md) — 研究状态如何落盘。**目录结构部分已被 Postgres 架构取代，实体/关系建模思路仍成立，见文中 Superseded 标注**。
5. [Space](./design/space.md) — Research Wiki 与 Idea Meta Space（与画布运行时边界"Canvas"是两个不同概念，见 [ticket 08](../.scratch/coresearch-saas-architecture/issues/08-space-canvas-terminology-disambiguation.md)）。
6. [Idea 结构](./design/idea-structure.md) — Idea 身份、十维、Proposal、版本。

## 产品原则

> Agent 持续探索、提出候选、解释文献；用户负责确认、保留、组合和推进。Canvas 只保存用户认为值得留下的研究对象。

```text
Conversation = Exploration Space
Canvas       = Commitment Space
```

## 目录

```text
docs/
├── README.md                          ← 本文件
└── design/
    ├── README.md                      设计目录地图
    ├── research-flow.md               产品流程真值
    ├── idea-structure.md              Idea 对象与版本
    ├── space.md                       Wiki / Meta Space
    ├── workspace.md                   工作区与研究状态落盘
    ├── assets/                        概念图
    ├── idea-formation/                分步契约
    └── canvas/                        画布架构与 Huabu 映射
```

## 流程与分步文档的关系

产品导航以 [Research Flow](./design/research-flow.md) 为准：

```text
Seed → Direction Exploration → Deep Dive → Research Question
    → Problem → Hypothesis → Approach → Method & Evaluation
    → Idea Synthesis → Review → Versioning
```

`idea-formation/` 里的编号文件仍是旧导航下的实现草稿（例如 `02` 实际对应 Deep Dive，`03` 对应 Direction Exploration）。回写完成前不要按文件名顺序当作用户路径。

## 本仓库未收录

分步文档和空间设计中仍有指向原研究工作区的参考链接，例如：

- `references/Auto-claude-code-research-in-sleep/`（ARIS）
- `references/feynman/`
- `packages/skills/seed-interviewing/`

这些是设计时读过的外部参考，不是本仓库的一部分。
