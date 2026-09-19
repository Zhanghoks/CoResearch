# CoResearch SaaS：Agent Runtime / Worker Spec

来源：[ADR 0006](../adr/0006-agent-worker-pi-coding-agent-sdk.md)/[0011](../adr/0011-agent-messages-store-pi-session-entries-directly.md)/[0012](../adr/0012-agent-stream-transport-separate-from-canvas-realtime.md)、[ticket 14](../../.scratch/coresearch-saas-architecture/issues/14-agent-tool-write-permission-boundary.md)/[19](../../.scratch/coresearch-saas-architecture/issues/19-agent-worker-run-scheduling.md)/[20](../../.scratch/coresearch-saas-architecture/issues/20-agent-pi-session-persistence-adapter.md)。所有 `@earendil-works/pi-coding-agent` API 形状本次会话已用 `gh api`/npm registry 核实过源码，不是转述。

## 1. Fail-closed 工厂函数（`apps/worker/src/createCoResearchAgentSession.ts`）

```ts
import { createAgentSession, SessionManager, type Model } from '@earendil-works/pi-coding-agent';

const RESEARCH_TOOL_ALLOWLIST = [
  'search_papers', 'read_paper', 'inspect_research_state',
  'propose_candidates', 'propose_revision', 'ask_user',
] as const;

export async function createCoResearchAgentSession(opts: {
  model: Model;
  projectId: string;
  threadId: string;
  entries?: FileEntry[];   // resume 时传，见 §3
}) {
  const { session } = await createAgentSession({
    model: opts.model,
    resourceLoader: coresearchResourceLoader,   // §2，不用 DefaultResourceLoader
    sessionManager: SessionManager.inMemory(opts.threadId, undefined, opts.entries),
    tools: RESEARCH_TOOL_ALLOWLIST,             // 显式白名单，SDK 不传时默认 read/bash/edit/write
    customTools: coresearchTools,               // §4 的 6 个 defineTool()
  });
  assertExposedToolsMatch(session, RESEARCH_TOOL_ALLOWLIST);  // 启动即失败，不静默放行
  return session;
}

// 生产代码禁止直接 import { createAgentSession } from '@earendil-works/pi-coding-agent'——
// 只能通过这个工厂函数。建议加一条 ESLint no-restricted-imports 规则强制。
```

## 2. 自定义 `ResourceLoader`（`apps/worker/src/coresearchResourceLoader.ts`）

```ts
export const coresearchResourceLoader: ResourceLoader = {
  getExtensions: async () => [],          // V1 不做任何 extension（见 ticket 16 的范围判断）
  getSkills: async () => BUILTIN_SKILLS,  // 仓库内置，写死在代码里，不做 .agents/skills/ 文件系统发现
  getSystemPrompt: () => CORESEARCH_SYSTEM_PROMPT,
  getPrompts: async () => [],
  getAgentsFiles: async () => [],
};
// 传自定义 ResourceLoader 后 cwd/agentDir 不再控制资源发现（SDK 文档核实的行为）
```

## 3. Claim / Lease / Cancel 循环（`apps/worker/src/runLoop.ts`）

```ts
async function workerLoop(workerId: string) {
  while (true) {
    const run = await claimNextRun(workerId);  // 01-database-schema.md §4 的 claim SQL
    if (!run) { await sleep(1000); continue; }
    await processRun(run, workerId);
  }
}

async function processRun(run: AgentRun, workerId: string) {
  if (run.cancelRequested) { await markCancelled(run.id); return; }

  const entries = await loadThreadEntries(run.threadId);  // SELECT agent_messages ORDER BY id
  const session = await createCoResearchAgentSession({
    model: resolveModel(run), projectId: run.projectId, threadId: run.threadId, entries,
  });

  const heartbeat = setInterval(() => touchLease(run.id, workerId), 15_000);
  const cancelPoll = setInterval(async () => {
    if (await checkCancelRequested(run.id)) await session.abort();
  }, 2_000);

  session.subscribe((event) => {
    publishEphemeral(run.id, adaptPiEvent(event));  // §5，pg_notify，从不落库
  });

  try {
    await session.prompt(run.prompt);
    // Pi 只在轮次完整完成时才产出 SessionEntry；Worker 收到就落一行 agent_messages
    // （SDK 内部机制，这里不需要额外订阅"entry 完成"事件，session.messages 变化时写）
    await persistNewEntries(run.threadId, session);
    await markCompleted(run.id);
  } catch (err) {
    await markFailed(run.id, err);
  } finally {
    clearInterval(heartbeat);
    clearInterval(cancelPoll);
    session.dispose();
  }
}
```

## 4. 六个工具（`apps/worker/src/tools/`）

```ts
import { Type } from 'typebox';
import { defineTool } from '@earendil-works/pi-coding-agent';

export const searchPapers = defineTool({
  name: 'search_papers',
  description: '检索外部文献（Semantic Scholar/OpenAlex/Crossref/arXiv，见 ticket 15）',
  parameters: Type.Object({ query: Type.String(), limit: Type.Optional(Type.Number()) }),
  execute: async (_id, params, ctx) => ({ content: [{ type: 'text', text: await searchLiteratureProviders(params, ctx) }], details: {} }),
});

export const readPaper = defineTool({
  name: 'read_paper',
  parameters: Type.Object({ paperId: Type.String() }),
  execute: async (_id, params, ctx) => ({ content: [{ type: 'text', text: await readPaperContent(params.paperId, ctx) }], details: {} }),
});

export const inspectResearchState = defineTool({
  name: 'inspect_research_state',
  parameters: Type.Object({ kind: Type.Optional(Type.String()), status: Type.Optional(Type.String()) }),
  execute: async (_id, params, ctx) => ({
    content: [{ type: 'text', text: JSON.stringify(await readResearchState(ctx, params)) }],
    details: {},
  }),
  // 薄封装：直接调 packages/research 的 readResearchState()（04-research-domain-service.md §5），
  // 不在这里重新实现查询逻辑
});

export const proposeCandidates = defineTool({
  name: 'propose_candidates',
  parameters: Type.Object({ kind: Type.String(), payload: Type.Unknown(), rationale: Type.Optional(Type.String()) }),
  execute: async (_id, params, ctx) => {
    const { candidateId } = await proposeCandidate(ctx, params);  // 04-research-domain-service.md §3
    return { content: [{ type: 'text', text: `Proposed ${params.kind} candidate ${candidateId}` }], details: { candidateId } };
  },
});

export const proposeRevision = defineTool({
  name: 'propose_revision',
  parameters: Type.Object({ entityId: Type.String(), baseStateRevision: Type.Number(), kind: Type.String(), changes: Type.Array(Type.Unknown()), rationale: Type.Optional(Type.String()) }),
  execute: async (_id, params, ctx) => {
    const { proposalId } = await proposeRevision(ctx, params);  // 04-research-domain-service.md §4
    return { content: [{ type: 'text', text: `Proposed revision ${proposalId}` }], details: { proposalId } };
  },
});

export const askUser = defineTool({
  name: 'ask_user',
  parameters: Type.Object({ question: Type.String() }),
  execute: async (_id, params) => ({ content: [{ type: 'text', text: params.question }], details: {} }),
});

export const coresearchTools = [searchPapers, readPaper, inspectResearchState, proposeCandidates, proposeRevision, askUser];
```

**没有 `accept_candidate`/`accept_proposal`/画布命令工具**——[ADR 0007](../adr/0007-agent-tool-set-drops-canvas-commands.md) 已经定死，这几个永远不出现在 `coresearchTools` 里，不是"忘了加"。

## 5. `PiEventAdapter`（`apps/worker/src/adaptPiEvent.ts`）

Pi SDK 事件名 → CoResearch SSE 事件名（[ADR 0012](../adr/0012-agent-stream-transport-separate-from-canvas-realtime.md)）：

```ts
const EVENT_MAP: Record<string, string> = {
  agent_start: 'run.started',
  message_start: 'message.started',
  message_update: 'message.delta',   // 仅当 assistantMessageEvent.type === 'text_delta'
  message_end: 'message.completed',
  tool_execution_start: 'tool.started',
  tool_execution_update: 'tool.updated',
  tool_execution_end: 'tool.completed',
  agent_end: 'run.completed',
};

export function adaptPiEvent(event: AgentSessionEvent): { type: string; payload: unknown } | null {
  const mapped = EVENT_MAP[event.type];
  if (!mapped) return null;   // queue_update/compaction_* 等不转发给浏览器
  return { type: mapped, payload: pickSerializable(event) };  // 截断大 payload，NOTIFY 上限 8000 字节
}
```

## 6. 验收条件（直接来自 ADR 0006，写成测试而不是文档提醒）

```ts
it('never exposes Pi coding tools', async () => {
  const session = await createCoResearchAgentSession(testOpts);
  const active = session.agent.state.tools.map(t => t.name);
  for (const banned of ['read', 'bash', 'write', 'edit', 'powershell']) {
    expect(active).not.toContain(banned);
  }
});

it('exposed tool set matches RESEARCH_TOOL_ALLOWLIST exactly', async () => {
  const session = await createCoResearchAgentSession(testOpts);
  const active = session.agent.state.tools.map(t => t.name).sort();
  expect(active).toEqual([...RESEARCH_TOOL_ALLOWLIST].sort());
});
```
