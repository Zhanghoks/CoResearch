# CoResearch SaaS：实现地图（阶段三）

## Destination

**这张地图承载执行，不是决策**——覆盖阶段一（[决策地图](../coresearch-saas-architecture/map.md)，22 条决策）与阶段二（[docs/spec/](../../docs/spec/) 六份实现级 spec）已经锁定的东西，用 tracer-bullet 垂直切片写成能跑的代码，不按层横切。默认的 wayfinder"只规划不执行"在这里被覆盖：每张 ticket 的完成标准是代码写完、能跑、测试过。

**Milestone 1**（07 + 08）已绿。**第二批**：09（Proposal Track B）和 10（Worker 韧性）已进入 execution frontier 并落地。

## Notes

- 遇到实现过程中冒出的新架构判断（不是"怎么写这段代码"，是"要不要这么设计"这类），回到[决策地图](../coresearch-saas-architecture/map.md)补 ticket，不在这里现场拍板。
- 遵守 vertical-slice 原则（`/to-tickets` skill）：每张 ticket 端到端可演示，不是单层实现；机械的宽幅重构（wide refactor）才走 expand-contract，不强塞进 tracer bullet。
- 每张 ticket 完成后跑一次相关包的 `pnpm typecheck`/`pnpm test` 再标 resolved。
- 首批 migration 只建已锁定的表——`usage_ledger`/`blobs`/`papers` 不是决策，不提前建（[01 号](issues/01-monorepo-and-locked-schema.md) 的教训：之前把 spec 文档里的"first-pass"字段抄进了 migration，属于实现阶段顺手创造未锁定 schema，已改正）。
- 源码出处 `Huabu-main/`（MIT）：直接复制的片段保留版权声明；只借架构决策的部分在文件头注明来源。

## 依赖图

```text
01 Monorepo + 确定性首批 Schema
├── 02 Canvas Engine Core
└── 03 RequestContext + RLS
     ↓
    04 Auth → Project → Primary Canvas
     ↓
    05 Note 编辑 → DB → Realtime + Catch-up
     ↓
    06 Deterministic Candidate → Accept → Projection (V3A)
    ├── 07 Research-managed Node Ownership (V4)          ← 只需要 06，不需要 08
    └── 08 Pi Agent → Candidate → 同一 Accept Path (V3B)   ← 已绿
         ├── 09 Proposal Track B (V5)          ← 已绿
         └── 10 Worker 韧性 (V6)                ← 已绿

Milestone 1 = 07 + 08 都绿
第二批 = 09 + 10 都绿
```

## Decisions so far

- [01](issues/01-monorepo-and-locked-schema.md) resolved：pnpm workspace + 锁定的 15 张表 migration 在托管项目 `bpxlnucpdmunyvwjpjov` 上跑通。
- [02](issues/02-canvas-engine-core.md) resolved：`packages/engine` 移植 executor + CREATE_NODES/DELETE_NODES + delta/invert + preAssignIds，测试 10/10。
- [03](issues/03-request-context-and-rls.md) resolved：`withRequestContext` + 15 张表 RLS 已应用到托管项目；跨租户查询被拦。
- [04](issues/04-auth-project-primary-canvas.md) resolved：Supabase JWT 验签 + `POST/GET /api/projects` + `GET /api/canvases/:canvasId`（空画布）；Web 外壳照搬 Huabu `apps/web` 改装（router/guard/store/api client）。真实浏览器 magic-link 往返未验证（本会话无 Supabase 凭证）。
- [05](issues/05-note-editing-realtime-catchup.md) resolved：note 的 create/move/edit/delete 走 `/execute` + advisory lock + `canvas_deltas`；catch-up 端点和 `nextSyncAction` 已测。双标签页 Realtime 代码已接，未在真实浏览器验证。
- [06](issues/06-deterministic-candidate-accept.md) resolved：fixture `CandidatePart` → accept 单事务物化 entity+revision+crEntity+projection+delta；幂等与回滚已测。GET overlay 经 `canvas_projections`。
- [07](issues/07-research-managed-node-ownership.md) resolved：`executeFromRequest` / `executeAsProjector` 双入口；owned MERGE → `invalid-scope`；`userNote` 可写；投影器刷新同一 nodeId、几何不动。
- [08](issues/08-pi-agent-candidate.md) resolved：Pi fail-closed 工厂 + 自定义 ResourceLoader + threads/runs/SSE；`propose_candidates` 写 SessionEntry，accept 复用 06。真实 LLM 往返未测。
- [09](issues/09-proposal-track-b.md) resolved：`propose_revision` 写 pending `proposals`；GET 列表走 Idea Meta Space Review 侧栏；accept CAS + 投影刷新同一 nodeId；reject 只改 status。
- [10](issues/10-worker-resilience.md) resolved：claim 含 lease 过期 steal + `SKIP LOCKED`；15s 心跳 / 2s 取消轮询 / `session.abort()`；`POST /api/runs/:id/cancel`。双进程手测未做。

## Not yet specified

- Agent Worker 的具体部署方式（进程管理、多实例伸缩）——留到有真实负载时再定
- CI/CD、部署脚本——明确 Out of scope

## Out of scope

- 计费系统、部署运维——阶段一地图已经排除，这里同样排除
- `usage_ledger`/`blobs`/`papers` 的完整 schema——留到真正需要它们的 ticket（大概率在 09/10 之后）
