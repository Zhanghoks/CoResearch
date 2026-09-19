# CoResearch SaaS：Research Domain 服务层 Spec

来源：[ADR 0001](../adr/0001-hybrid-backend-supabase-as-infra.md)/[0004](../adr/0004-candidate-vs-proposal-two-track-model.md)/[0005](../adr/0005-candidate-acceptance-transaction-shape.md)/[0013](../adr/0013-rls-policy-pattern.md)、[ticket 11](../../.scratch/coresearch-saas-architecture/issues/11-research-entity-lifecycle-and-candidate-model.md)/[12](../../.scratch/coresearch-saas-architecture/issues/12-candidate-acceptance-flow-and-canvas-projection-lifecycle.md)。函数签名，不是完整实现。

## 1. 所有权投影（`packages/research/src/ownership.ts`）

照 Huabu `agentNodeOwnership.ts` 的三函数形状（[03-canvas-engine-port.md](./03-canvas-engine-port.md) §1）：

```ts
export const RESEARCH_OWNED_DATA_KEYS = [
  'entityKind', 'currentRevision', 'contentHash', 'status',
  'origin', 'confirmed', 'stale', 'summary', 'payload',
] as const;

export const USER_OWNED_DATA_KEYS = ['userNote', 'pinned', 'collapsed'] as const;
// USER_OWNED_DATA_KEYS 对应 canvas_nodes.native_data 里 crEntity 节点允许的字段，
// 不是 research_entities 表的列——这条边界本身就是 ADR 0008 的"crEntity native_data
// 最多装画布层批注"。

export function projectResearchEditableData(data: unknown): Partial<ResearchEntityData>;
// 剔除 RESEARCH_OWNED_DATA_KEYS，浏览器保存 canvas_nodes.native_data 时用这个过滤

export function preserveResearchOwnedData(
  incoming: Partial<ResearchEntityData>,
  current: ResearchEntityData,
): ResearchEntityData;
// 用 current 的托管字段值强制覆盖 incoming，写入路径上无条件投影

export function replayResearchEditableData(
  current: ResearchEntityData,
  before: ResearchEntityData,
  after: ResearchEntityData,
): Partial<ResearchEntityData>;
// 撤销重放：逐键比较 before/after，只放差异字段，跳过 RESEARCH_OWNED_DATA_KEYS——
// 旧快照里的 status/confirmed 是"当时的观测值"，撤销不该把业务状态倒带
```

## 2. 双入口（`packages/research/src/write-entry.ts`）

**权限判定落在函数入口，不是参数**——这是 [ADR 0001](../adr/0001-hybrid-backend-supabase-as-infra.md) 的核心约束，具体落实成两个不同的导出，不是同一个函数传 `source` 参数：

```ts
// 只能被 apps/api 的 projector 模块调用，内部用 service_role 连接
export async function executeAsProjector(plan: ProjectionPlan): Promise<ProjectionResult>;

// 所有 HTTP 路径调用这个，内部用 coresearch_app 连接（RLS 生效）
// 任何 body 里出现 RESEARCH_OWNED_DATA_KEYS 里的字段，直接拒绝，reason: 'invalid-scope'
export async function executeFromRequest(
  ctx: RequestContext,
  patch: CanvasNodeDataMergePatch,
): Promise<ExecuteResult>;
```

`executeFromRequest` 的拒绝**不看请求体里有没有 `source:'system'` 这种自称标签**（Huabu 连标了 system 的伪造请求也拒绝）——CoResearch 的区别是投影器**确实**是 system，所以两条路径从函数导出层面就物理分开，而不是同一个入口检查一个可被客户端伪造的字段。

## 3. Track A — Candidate（`packages/research/src/candidate.ts`）

```ts
export interface CandidatePart {
  type: 'research_candidate';
  candidateId: string;          // = 所在 agent_messages 行的 id（见 01-database-schema.md 的拼装简化）
  schemaVersion: 1;
  kind: ResearchEntityKind;
  payload: unknown;
  provenance: { runId: string; messageId: string; derivedFrom?: string[]; asOf?: string };
  materialized?: { entityId: string; at: string };
}

// Agent 工具 propose_candidates 的实现调这个——只写 agent_messages 的 CustomMessage，
// 不碰 research_entities
export async function proposeCandidate(
  ctx: AgentRunContext,
  candidate: Omit<CandidatePart, 'candidateId' | 'materialized'>,
): Promise<{ candidateId: string }>;

// POST /api/projects/:projectId/candidates/:candidateId/accept 调这个
// 单事务：见 ADR 0005 的完整流程；这里只给函数签名
export async function acceptCandidate(
  ctx: RequestContext,
  candidateId: string,
  placement: { canvasId: string; parentNodeId?: string; position: { x: number; y: number } },
): Promise<{ entityId: string; nodeId: string; alreadyMaterialized: boolean }>;
```

## 4. Track B — Proposal（`packages/research/src/proposal.ts`）

```ts
// Agent 工具 propose_revision 的实现调这个——写 proposals(status:'pending')，不碰 canvas
export async function proposeRevision(
  ctx: AgentRunContext,
  input: { entityId: string; baseStateRevision: number; kind: ProposalKind; changes: ProposalChange[]; rationale?: string },
): Promise<{ proposalId: string }>;

export async function acceptProposal(ctx: RequestContext, proposalId: string): Promise<AcceptProposalResult>;
// 校验 baseStateRevision === research_entities.current_revision，不符直接拒绝（CAS）
// 应用 changes，current_revision += 1，插入 research_entity_revisions
// 若已有 canvas_projections 绑定，标记该 canvas 需要刷新渲染（不新建节点）

export async function rejectProposal(ctx: RequestContext, proposalId: string): Promise<void>;
// 只改 proposals.status，不碰目标实体
```

## 5. 读路径（`packages/research/src/read.ts`）

```ts
export async function readResearchState(
  ctx: RequestContext | AgentRunContext,
  filter?: { kind?: ResearchEntityKind; status?: string },
): Promise<{ entities: ResearchEntity[]; relations: ResearchRelation[] }>;
// GET /api/projects/:projectId/research 和 Agent 工具 inspect_research_state 共用这一个函数
```

## 6. 投影器（`apps/api/src/research/projector.ts`）

照 `planWorldPreviewReconciliation()` 的四条规则（huabu-reverse-engineering.md §5）：

```ts
export interface ProjectionPlan {
  createInputs: CanvasNodeCreateInput[];    // research_entities 有、canvas_projections 没有
  deleteNodeIds: CanvasNodeId[];            // canvas_projections 有、对应 research_entities 已删除
  mergePatches: CanvasNodeDataMergePatch[]; // 两边都有但 contentHash 不符 → 置 stale
  connectInputs: never[];                   // 关系边是虚拟的，投影器不发 CONNECT_NODES（ADR 0008）
}

export function planProjection(state: { canvasId: string }): Promise<ProjectionPlan>;
export function reconcileProjectionOnce(canvasId: string): Promise<void>;
// 不发明新命令，只用 CREATE_NODES/DELETE_NODES/MERGE_NODE_DATA（走 executeAsProjector）
// 保留既有节点身份与用户几何（canvas_layout 不动）
// 被拒不静默吞掉——重新 plan，验证为空才算成功，否则抛错
// 串行化：复用 withCanvasMutex，同一把锁
```

新节点分配位置前**先排序再分配**——实体列表读取顺序不保证稳定，确定性布局靠显式排序（按 `created_at` 或 `sequence_index`），不靠后端扫描顺序。
