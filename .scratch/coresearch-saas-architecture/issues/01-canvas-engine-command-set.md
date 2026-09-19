# Canvas 引擎移植边界与命令集裁剪

Type: grilling
Status: resolved

## Question

Huabu 的 canvas-engine 有 17 种命令、结构化 Frame 求解器、自动边路由等能力。CoResearch V1 要移植哪些、裁掉哪些？

## Answer

按 `docs/design/canvas/huabu-reverse-engineering.md` §8/§9 的保留/砍掉清单：原样移植纯函数执行器（`executeCanvasCommands`、`PendingEffects` 纯数据、粗粒度可逆 delta、批次末尾统一 pass 只留 `normalizeTreeOrder`、`preAssignIds`、no-op 不 bump 版本、CAS 的 `'not-read'` 语义）。命令集从 17 条裁到 8 条：`CREATE_NODES` / `DELETE_NODES` / `MERGE_NODE_DATA` / `SET_NODE_GEOMETRY` / `SET_NODE_PARENT` / `CONNECT_NODES` / `DISCONNECT_EDGES` / `SET_NODE_SELECTION`。砍掉结构化 Frame 求解器、自动边路由、sketch/office/video/audio 节点、Electron、多 Workspace/World、节点预处理管线、interactive views、SQLite 后端。详见 `/Users/zmj/.claude/plans/huabu-saas-breezy-heron.md` §一/1.3 与 §三。

**追加（[ADR 0010](../../../docs/adr/0010-restore-structured-frame-layout.md)，reopen）**：结构化 Frame 求解器的裁剪部分撤回——`SET_FRAME_LAYOUT` 恢复，命令集变成 **9 条**（加上第 9 条 `SET_FRAME_LAYOUT`）。原因：[Step 泳道](22-step-swimlane-frame-layout.md) 需要处理删除中间节点后的空隙压缩、节点高度随 revision 变化后的下游让位，这两个场景靠 Research Projector 手写等于重新发明半个布局引擎。其余被砍命令（`ALIGN_NODES`/`DISTRIBUTE_NODES`/`REORDER_NODES`/`DISSOLVE_FRAME`/`SET_NODE_LOCKED`/`CHANGE_NODE_TYPE`/`APPLY_MEASURED_HEIGHT`）维持砍掉，自动边路由/sketch 等节点类型/Electron/多 Workspace 等其余裁剪不受影响。Huabu 的 `gridLayout.ts`（`column`/`row`/`grid` 共用算法）完整保留，V1 产品策略层只暴露 `free`/`column`——代码能力不等于 V1 产品暴露能力。
