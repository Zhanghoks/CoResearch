# Canvas 引擎移植边界与命令集裁剪

Type: grilling
Status: resolved

## Question

Huabu 的 canvas-engine 有 17 种命令、结构化 Frame 求解器、自动边路由等能力。CoResearch V1 要移植哪些、裁掉哪些？

## Answer

按 `docs/design/canvas/huabu-reverse-engineering.md` §8/§9 的保留/砍掉清单：原样移植纯函数执行器（`executeCanvasCommands`、`PendingEffects` 纯数据、粗粒度可逆 delta、批次末尾统一 pass 只留 `normalizeTreeOrder`、`preAssignIds`、no-op 不 bump 版本、CAS 的 `'not-read'` 语义）。命令集从 17 条裁到 8 条：`CREATE_NODES` / `DELETE_NODES` / `MERGE_NODE_DATA` / `SET_NODE_GEOMETRY` / `SET_NODE_PARENT` / `CONNECT_NODES` / `DISCONNECT_EDGES` / `SET_NODE_SELECTION`。砍掉结构化 Frame 求解器、自动边路由、sketch/office/video/audio 节点、Electron、多 Workspace/World、节点预处理管线、interactive views、SQLite 后端。详见 `/Users/zmj/.claude/plans/huabu-saas-breezy-heron.md` §一/1.3 与 §三。
