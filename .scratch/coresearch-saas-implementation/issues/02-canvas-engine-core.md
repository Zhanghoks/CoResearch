# 02: Canvas Engine Core

**What to build:** `packages/engine` 里能跑的最小引擎——`executeCanvasCommands` + `CREATE_NODES`/`DELETE_NODES` 两条命令 + delta/`invertDelta` + `preAssignIds` + 批次末尾统一 pass 的核心不变量（树序 `normalizeTreeOrder`、全拒即 no-op、版本语义）。不是"9 条命令全移植"——其余 7 条（`MERGE_NODE_DATA`/`SET_NODE_GEOMETRY`/`SET_NODE_PARENT`/`CONNECT_NODES`/`DISCONNECT_EDGES`/`SET_NODE_SELECTION`/`SET_FRAME_LAYOUT`）跟着后面真正用到它们的垂直切片逐步补，不在这张里一次做完。来源：[docs/spec/03-canvas-engine-port.md](../../../docs/spec/03-canvas-engine-port.md) §1/§5 步骤 1，源文件相对 `Huabu-main/packages/shared/src/canvas-engine/`。

**Blocked by:** 01（需要 workspace 结构；不需要 DB，纯 Node）。

**Status:** resolved

- [x] `executor.ts`/`interfaces.ts`/`delta.ts`/`diff.ts` 照抄结构（`docs/spec/03` §1 的处理方式）
- [x] `commands/createNodes.ts`/`commands/deleteNodes.ts`/`commands/types.ts`/`commands/index.ts` 落地，注册表穷尽映射
- [x] 测试覆盖 Huabu 原有 `__tests__/` 的核心点：delta 往返、树序不变量、全拒即 no-op、`preAssignIds` 不接受 agent 自带 id
- [x] `@xyflow/react` 只作类型导入，加一条 ESLint 规则强制（`packages/engine` 下禁止运行时导入）
- [x] `pnpm --filter @coresearch/engine test` 全绿

## Answer

`packages/engine` 落地，源文件相对 `Huabu-main/packages/shared/src/canvas-engine/` 逐个搬：

- `interfaces.ts`/`delta.ts`/`diff.ts` 照抄（`PendingEffects` 裁到 `mutatedNodes`/`deletedNodeIds` 两个字段，`deferredFitFrameIds` 等 web-only/frame-fit 字段留给后面的 ticket）。
- `executor.ts` 照抄批次调度 + `normalizeTreeOrder` 收尾 + 版本语义（全拒 = 原样引用、`snapshotNeeded:false`），砍掉结构化 Frame 重排 pass 和 note provenance（两者都要 `SET_FRAME_LAYOUT`/`MERGE_NODE_DATA`，本张不实现）。
- `container/policy.ts`/`container/tree.ts` 照抄（`normalizeTreeOrder` 全套：dangling-parent 剥离、frame 子节点 zIndex、成环兜底）。
- `commands/createNodes.ts`/`deleteNodes.ts` 按 Huabu 结构做了收窄：label 自动生成/去重、accent 默认样式、auto-height materialize、`question` 类型的 ownership 投影这些 Huabu 特性本张用不到，注释里写清楚各自跟哪张后续 ticket走（web 接线 ticket 补样式/标签，07 号补 ownership）；新增 `CREATE_NODES` 对批内/已有节点重复 id 的显式拒绝（`reason:'duplicate-id'`）。
- `preAssignIds` 按 CoResearch 特有规则收紧：`source:'agent'` 的批次里，调用方自带的 node id 一律不采信、强制重新分配（Huabu 原版只补空 id）——依据是归档计划里的不变量"Agent 新建节点后要连线，用 `results[].nodes` 回传的 id；自带 id 的 `CREATE_NODES` 被拒"。目前是静默重分配，不是硬拒绝；真正端到端的拒绝测试留给 08 号（有真实 Agent 批次时再写）。
- `packages/shared` 补了 `canvas/command.ts`（`CanvasCommand` 目前只声明 `CREATE_NODES`/`DELETE_NODES` 两个成员，故意不预声明 9 条——`HANDLERS` 对 `CanvasCommandType` 的穷尽检查因此只覆盖已实现的两条,新增命令时类型和 handler 一起加）、`canvas/node.ts`（6 种 `node_type`，每类 `data` 先留 `Record<string, unknown>`，因为 crEntity 的托管字段等实际决定权在 04/07 号）、`canvas/layout.ts`（先只放 `Point`）、`utils/id.ts`（`createId`，照抄）。
- ESLint（`packages/engine/eslint.config.js`）用 `@typescript-eslint/no-restricted-imports` 的 `allowTypeImports` 挡运行时 `@xyflow/react` 导入；配了一条独立测试（`xyflow-imports.test.ts`）静态扫描 `src/**/*.ts` 兜底。
- `pnpm install`、`pnpm typecheck`、`pnpm test`、`pnpm lint` 全仓库跑绿（`packages/engine`：10 个测试全过；`packages/shared`/`apps/*` typecheck 干净）。

Frontier 现在是 [03](03-request-context-and-rls.md)（并行中）解决后解锁 [04](04-auth-project-primary-canvas.md)。
