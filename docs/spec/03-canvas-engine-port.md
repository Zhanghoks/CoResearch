# CoResearch SaaS：Canvas Engine 移植清单

来源：[ticket 01](../../.scratch/coresearch-saas-architecture/issues/01-canvas-engine-command-set.md)、[ADR 0002](../adr/0002-canvas-concurrency-and-realtime-sync.md)/[0008](../adr/0008-canvas-canonical-storage-unified-nodes.md)/[0010](../adr/0010-restore-structured-frame-layout.md)、`docs/design/canvas/huabu-reverse-engineering.md` §8/§11。源文件路径相对 `Huabu-main/packages/shared/src/`。

**核实边界说明**：`commands/` 下逐文件的保留/砍掉清单，和 `executor.ts`/`interfaces.ts`/`delta.ts`/`command.ts`/`node.ts` 这几个文件，本次逆向和 ADR 0010 的源码核查（`setFrameLayout.ts`/`gridLayout.ts`/`node.ts` 的 `frameColumn`/`frameRow`/`FRAME_LAYOUT_MODES` 字段）直接读过。`canvas-engine/container/`、`frame/`、`height/` 这三个子目录**没有逐文件读过**，下面列的是"大概率需要，移植时以实际导入关系为准"，不是核实结论——实现时先跑 `tsc`/引用检查，Huabu 的 `gridLayout.ts`/`setFrameLayout.ts` 依赖到什么就带什么，不要凭这份清单猜漏。

## 1. `packages/engine/src/`（新仓库路径，对应 Huabu `canvas-engine/`）

| 源文件 | 处理 | 依据 |
|---|---|---|
| `executor.ts` | 照抄结构。批次末尾统一 pass：保留 `normalizeTreeOrder`，**恢复结构化 Frame 重排 pass**（[ADR 0010](../adr/0010-restore-structured-frame-layout.md) 之前误判为不需要），砍掉 note provenance 那段（block-level 归属追踪，CoResearch 用不到） | ticket 01 + ADR 0010 更正 |
| `interfaces.ts` | 原样。`CanvasReadState`/`CanvasWriteResult`/`PendingEffects` | ticket 01 |
| `delta.ts` | 原样。6 种粗粒度 delta + `invertDelta` + 宽容 `applyDeltas` | ticket 01 |
| `diff.ts` | 原样 | huabu-reverse-engineering.md §11 |
| `postEffects.ts` | 保留服务端相关部分，砍掉 web-only 语义（`deferredFitFrameIds` 这类） | huabu-reverse-engineering.md §1.2 |
| `agentNodeOwnership.ts` | **不直接复用**，抄它的三函数形状（`project*EditableData`/`preserve*OwnedData`/`replay*EditableData`）实现 CoResearch 自己的 `packages/research/ownership.ts`，见 [04-research-domain-service.md](./04-research-domain-service.md) | ADR 0001 |
| `autoLayout/gridLayout.ts` | **恢复保留**（原判断砍掉，被 ADR 0010 推翻），`column`/`row`/`grid` 完整算法都要，V1 只在产品策略层暴露 `free`/`column` | ADR 0010 |
| `commands/` | 见下表，9 个命令文件 + `types.ts` + `index.ts`（穷尽注册表，砍掉的命令不出现在 `HANDLERS`/`COMMAND_META`） | ticket 01 + ADR 0010 |
| `container/`、`frame/`、`height/` | **未逐文件核实**——`gridLayout.ts`/`setFrameLayout.ts` 大概率依赖其中的辅助工具（尤其 `height/` 可能关联 `node-auto-height.md` 提到的测量高度机制，`SET_FRAME_LAYOUT` 的 `sizing:'hug'` 需要知道子节点实际高度）；移植时跟着 import 链走，缺什么补什么 | 未核实，标注清楚 |
| `provenance/` | 砍掉，不移植 | ticket 01 |

**命令文件**（`commands/`）：

| 文件 | 保留？ |
|---|---|
| `createNodes.ts` | ✅ |
| `deleteNodes.ts` | ✅ |
| `mergeNodeData.ts` | ✅ |
| `setNodeGeometry.ts` | ✅ |
| `setNodeParent.ts` | ✅ |
| `connectNodes.ts` | ✅ |
| `disconnectEdges.ts` | ✅ |
| `setNodeSelection.ts` | ✅ |
| `setFrameLayout.ts` | ✅（[ADR 0010](../adr/0010-restore-structured-frame-layout.md) 恢复） |
| `alignNodes.ts` / `distributeNodes.ts` / `reorderNodes.ts` / `setNodeLocked.ts` / `changeNodeType.ts` / `dissolveFrame.ts` / `applyMeasuredHeight.ts` / `setEdgeStyle.ts` | ❌ 不移植，注册表里没有对应条目——以后要加，照 Huabu 源文件原样搬一个进来，改两行注册即可 |

## 2. `packages/shared/src/types/canvas/`

| 文件 | 处理 |
|---|---|
| `command.ts` | 判别联合裁到 9 条（见 [02-api-contract.md](./02-api-contract.md) §3 的命令清单） |
| `execution.ts` | 原样：`source: 'ui'|'agent'|'system'`、8 值失败枚举、`ExecuteConflict` |
| `node.ts` | 裁掉 sketch/office/video/audio 相关类型；保留 `crEntity`/`frame`/`note`/`question`/`pdf`/`web` 六种 `node_type`（对应 [ADR 0008](../adr/0008-canvas-canonical-storage-unified-nodes.md) 的 `canvas_nodes.node_type`）；`FRAME_LAYOUT_MODES`/`FRAME_SIZING_MODES`/`frameColumn`/`frameRow` 字段定义原样抄（[ADR 0010](../adr/0010-restore-structured-frame-layout.md) 源码核实过的形状） |
| `edge.ts` | 原样，区分 `canvas_edges`（纯画布）和虚拟关系边（渲染时计算，不在这个类型里建模成"边"，是投影器输出的展示层结构） |
| `color.ts`、`layout.ts` | 大概率保留（服务 `FrameLayoutMode` 相关渲染），未逐文件核实 |

## 3. Agent 禁止导入运行时代码

`@xyflow/react` 只作类型导入这条 ESLint 规则第一天就加（huabu-reverse-engineering.md §1.3）——引擎在 Node.js 里跑不摸 DOM，这是"同一引擎两端跑"的全部前提。`packages/engine/` 不得 `import` 除类型外的任何 `@xyflow/react` 运行时符号；违反直接是 lint error，不是 code review 靠人肉发现。

## 4. 宿主层（不是移植，是新写）

| 文件 | 职责 | 依据 |
|---|---|---|
| `apps/api/src/canvas/executor-host.ts` | `executeOnServer` 等价物：`preAssignIds`、no-op 不 bump 版本、`results[].nodes` 回传 | ticket 01 |
| `apps/api/src/canvas/advisory-lock.ts` | `withCanvasMutex(canvasId, task)`，内部是 `pg_advisory_xact_lock`，接口形状照抄 Huabu 的 `write-coordinator.ts`（13 行 promise 链换成 SQL） | [ADR 0002](../adr/0002-canvas-concurrency-and-realtime-sync.md) |
| `apps/api/src/canvas/ownership-guard.ts` | 双入口：`executeAsProjector()`（`service_role`，可写托管键）vs `executeFromRequest()`（`coresearch_app`，托管键写入直接拒绝） | [ADR 0001](../adr/0001-hybrid-backend-supabase-as-infra.md) |

## 5. 实施顺序（照抄 huabu-reverse-engineering.md §12 的分层好处：前三步纯 Node，无 UI）

1. `executeCanvasCommands` + `CREATE_NODES`/`DELETE_NODES` + delta + invert。测试先行：delta 往返、树序不变量、全拒即 no-op。
2. 所有权守卫：`RESEARCH_OWNED_DATA_KEYS` 三函数 + 双入口拒绝路径——必须先于任何 UI。
3. 补齐其余 7 条命令 + `withCanvasMutex` + `executeOnServer` 等价物 + `canvas_deltas` 写入。
4. 投影器只读跑通：Seed + 一条 Direction + Focus，从真实 `research_entities` 读（见 [04-research-domain-service.md](./04-research-domain-service.md)）。
5. staleness 检测。
6. web 端：xyflow + `crEntity` 渲染 + `applyDeltas` + Supabase Realtime 订阅。
7. uiIntent + resolvers（布局与批注，仅前端）。
