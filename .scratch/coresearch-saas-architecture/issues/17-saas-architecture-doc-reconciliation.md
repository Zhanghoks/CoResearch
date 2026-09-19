# 旧设计文档回写：标记 superseded 并对齐新架构基线

Type: task
Status: resolved

## Question

已核实：`docs/design/workspace.md`、`docs/design/canvas/research-canvas.md`（以及可能的 `huabu-domain-binding.md`/`huabu-reverse-engineering.md`）仍然描述的是"本地文件系统 + `.pi/` 挂载 + `research/` 为 source of truth + Disk/SQLite + 自建 SSE"这套 Huabu 原生单机模型，和本地图已经锁定的架构（Postgres 是 Research Domain 真值、Supabase 托管基础设施、Pi Coding Agent SDK、Canvas 是投影）直接冲突：

- `workspace.md:41-42` `.pi/` 由 `pi install` 管理、`settings.json` 是"已挂载 package 清单（source of truth）"——和 [16 号](16-agent-extension-architecture.md)/[ADR 0006](../../../docs/adr/0006-agent-worker-pi-coding-agent-sdk.md) 的"自定义 ResourceLoader，V1 只加载仓库内置、不做本地文件系统发现"直接冲突。
- `workspace.md:134,139` `research/` 是"source of truth"——和 `CONTEXT.md` 的 Research Domain 词条（project-scoped，落在 Postgres）冲突。
- `research-canvas.md:74-79` `space.json`/`nodes/*.md`/`delta-log.jsonl`——和 [ADR 0002](../../../docs/adr/0002-canvas-concurrency-and-realtime-sync.md)/[0005](../../../docs/adr/0005-candidate-acceptance-transaction-shape.md) 的 Postgres 表结构冲突。
- `research-canvas.md:210-211` `SSE 广播 delta`——和 [ADR 0002](../../../docs/adr/0002-canvas-concurrency-and-realtime-sync.md) 的 "Supabase Realtime 快路径 + durable catch-up API" 冲突。
- `research-canvas.md:275` "Disk / SQLite" 存储后端——和 [ADR 0001](../../../docs/adr/0001-hybrid-backend-supabase-as-infra.md) 的 Supabase Postgres 冲突。
- `docs/README.md:10`、`docs/design/README.md:11` 把 `workspace.md` 列为"研究状态如何落盘"的权威入口——回写完成前，这个索引本身在误导读者。
- `huabu-domain-binding.md:58` 出现裸的 `spaceId: string`——[ticket 08](08-space-canvas-terminology-disambiguation.md) 已经把这个概念改名 Canvas，这里没跟上。

## What to do

这是任务型 ticket（不是决策）：把上述文件里和已锁定 ADR 冲突的段落，按下面的规则处理，不引入新决策——遇到判断不了"这段该删还是该改写"的地方，标记出来交回地图而不是自己猜：

1. 明确和新架构矛盾、且新架构已有对应说法的段落：改写成和 ADR/CONTEXT.md 一致的表述，改写处标注引用的 ADR 编号。
2. 明确属于 Huabu 单机模型、CoResearch SaaS 不再需要的整段（比如 `.pi install` 机制说明）：整段标记 `> **Superseded**：见 [ADR XXXX]`，不删除原文——历史设计意图仍有参考价值，删除会丢失"当初为什么这么设计"的上下文。
3. `docs/README.md`/`docs/design/README.md` 的索引：给 `workspace.md`/`research-canvas.md` 加一句"本文档部分内容已被 wayfinder 地图的 ADR 取代，见 `.scratch/coresearch-saas-architecture/map.md`"。
4. 全仓库扫一遍裸的 `spaceId`/`space.json`/`GET /spaces/...`，统一改成 `canvasId`/对应的 Canvas 表名。
5. 完成后在本 ticket 的 Answer 里列出实际改了哪些文件、哪些段落判断不了留给了地图。

这个 ticket 不阻塞 09/10/13/18/19/20/21 的决策工作（互相独立），但**阶段二开始生成实现级 spec 之前必须完成**——不然 spec 编写者会同时读到两套互相矛盾的"权威文档"。

## Answer

实际改动的文件：

- **`docs/design/canvas/research-canvas.md`**：顶部加整体 Superseded 提示；§2.3（Agent `space_commands` 工具→已按 [ADR 0007](../../docs/adr/0007-agent-tool-set-drops-canvas-commands.md) 去掉）、§2.6（存储形状→Postgres，[ADR 0001](../../docs/adr/0001-hybrid-backend-supabase-as-infra.md)/[0002](../../docs/adr/0002-canvas-concurrency-and-realtime-sync.md)）、§3（`space.json`→`research_entities`）、§6（包结构→API/Worker 两进程，[ADR 0006](../../docs/adr/0006-agent-worker-pi-coding-agent-sdk.md)）、§7（数据流图→Postgres 表 + Supabase Realtime）、§11（"不照抄结构化求解器"→已被 [ADR 0010](../../docs/adr/0010-restore-structured-frame-layout.md) 推翻）逐段加 `> **Superseded**` 标注，原文保留。§4 的节点类型表（`crEntity`/`frame`/`note`/`question`/`pdf`/`web`）和 Step 泳道 `layout:'column'` 反而和最终决策一致，未改。
- **`docs/design/workspace.md`**：顶部加整体 Superseded 提示，明确"第 4 节的实体/关系建模思路仍是 `research_entities`/`research_relations` 的概念来源"；§2/§3/§6/§8 的目录结构/四层表/`.coresearch/`/artifacts 段落加 Superseded 标注；§5/§7 的 skill 组织加注（核实 Huabu 实际 skills 系统是内置 prompt 目录，不是可挂载扩展，[ticket 16](16-agent-extension-architecture.md)）；§10 核心结论改写并保留原句对照。
- **`docs/design/canvas/huabu-domain-binding.md`**：顶部加注（三处：`spaceId`→`canvasId`、外部 ACP 不在 V1 范围、Agent 画布操作能力已被 [ADR 0007](../../docs/adr/0007-agent-tool-set-drops-canvas-commands.md) 收窄）；`ResearchCanvasBinding.spaceId` 改名 `canvasId`；正文两处"Research Space"/"默认 Space"改成"Research Canvas"/"默认 Canvas"。本文其余部分（§5/§6/§8 的写入路径、确认边界）核对后和后续 ADR 高度一致，未改——"Frame 组织视图不推断领域类型"这条和 [ADR 0010](../../docs/adr/0010-restore-structured-frame-layout.md) 的 Hard Rule 字面一致，算是提前验证了后续决策的合理性。
- **`docs/design/canvas/huabu-reverse-engineering.md`**：命令集"8 条"更新为"9 条"（[ADR 0010](../../docs/adr/0010-restore-structured-frame-layout.md) 恢复 `SET_FRAME_LAYOUT`），两处代码注释同步。
- **`docs/README.md`**、**`docs/design/README.md`**：加架构真值优先级说明，指向 `CONTEXT.md`/`.scratch/coresearch-saas-architecture/map.md`/`docs/adr/`；对应文档条目标注哪些部分已被取代。

**全仓库扫过一遍**裸的 `spaceId`/`space.json`/`GET /spaces/...`（含 `.scratch/`、`CONTEXT.md`）：`ADR 0002`/[ticket 05](05-canvas-realtime-sync-strategy.md)/[ticket 12](12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md) 里的 `GET /spaces/:canvasId/deltas` 已经在 18/22 号讨论过程中顺手改成了 `GET /api/canvases/:canvasId/deltas`；`huabu-domain-binding.md` 的 `spaceId` 是本 ticket 改的；`huabu-reverse-engineering.md` 和 `CONTEXT.md` 里剩下的 `space.json` 提及都是在明确对比"Huabu 自己的 space.json 是什么"，不是对 CoResearch 自身存储的误导性描述，不需要改。

**判断不了、留给未来的**：`docs/design/workspace.md` §7 的 skill 目录组织形态（`packages/skills/<name>/`）要不要照搬，还是用别的组织方式——没有对应 ticket，已在文中加注标记为开放问题，不属于本 ticket 的架构回写范围。
