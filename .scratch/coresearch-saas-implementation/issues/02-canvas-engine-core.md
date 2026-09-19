# 02: Canvas Engine Core

**What to build:** `packages/engine` 里能跑的最小引擎——`executeCanvasCommands` + `CREATE_NODES`/`DELETE_NODES` 两条命令 + delta/`invertDelta` + `preAssignIds` + 批次末尾统一 pass 的核心不变量（树序 `normalizeTreeOrder`、全拒即 no-op、版本语义）。不是"9 条命令全移植"——其余 7 条（`MERGE_NODE_DATA`/`SET_NODE_GEOMETRY`/`SET_NODE_PARENT`/`CONNECT_NODES`/`DISCONNECT_EDGES`/`SET_NODE_SELECTION`/`SET_FRAME_LAYOUT`）跟着后面真正用到它们的垂直切片逐步补，不在这张里一次做完。来源：[docs/spec/03-canvas-engine-port.md](../../../docs/spec/03-canvas-engine-port.md) §1/§5 步骤 1，源文件相对 `Huabu-main/packages/shared/src/canvas-engine/`。

**Blocked by:** 01（需要 workspace 结构；不需要 DB，纯 Node）。

**Status:** ready-for-agent

- [ ] `executor.ts`/`interfaces.ts`/`delta.ts`/`diff.ts` 照抄结构（`docs/spec/03` §1 的处理方式）
- [ ] `commands/createNodes.ts`/`commands/deleteNodes.ts`/`commands/types.ts`/`commands/index.ts` 落地，注册表穷尽映射
- [ ] 测试覆盖 Huabu 原有 `__tests__/` 的核心点：delta 往返、树序不变量、全拒即 no-op、`preAssignIds` 不接受 agent 自带 id
- [ ] `@xyflow/react` 只作类型导入，加一条 ESLint 规则强制（`packages/engine` 下禁止运行时导入）
- [ ] `pnpm --filter @coresearch/engine test` 全绿
