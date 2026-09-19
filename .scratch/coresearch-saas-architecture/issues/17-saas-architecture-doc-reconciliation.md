# 旧设计文档回写：标记 superseded 并对齐新架构基线

Type: task
Status: open

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
