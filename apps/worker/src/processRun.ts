// One claimed run: subscribe → prompt → persist completed SessionEntry
// rows only (docs/spec/05 §3). Token deltas go through publish, never
// agent_messages. Cancel/heartbeat are ticket 10 (ADR 0006 / ticket 19).

import {
  CANCEL_POLL_MS,
  HEARTBEAT_MS,
  claimNextRun,
  heartbeatRun,
  isCancelRequested,
  markRun,
  persistSessionEntries,
  proposeCandidate,
  proposeRevision,
  type ClaimedRun,
  type SqlQuery,
} from "@coresearch/research";

import { adaptPiEvent, type AdaptedEvent } from "./adaptPiEvent.js";
import {
  createCoResearchAgentSession,
  type ResearchToolHost,
  type SessionModel,
} from "./createCoResearchAgentSession.js";
import { resolveSessionModel } from "./resolveModel.js";

export type AgentRunRow = ClaimedRun;

export type ProcessRunPublish = (
  runId: string,
  event: AdaptedEvent,
) => Promise<void>;

export { claimNextRun };

function abortSession(session: { abort?: () => void }): void {
  session.abort?.();
}

export async function loadThreadEntries(
  db: SqlQuery,
  threadId: string,
): Promise<unknown[]> {
  const rows = await db.query(
    `SELECT payload FROM agent_messages
      WHERE thread_id = $1::uuid
      ORDER BY created_at ASC`,
    [threadId],
  );
  return rows.rows.map((r) => r.payload);
}

export async function processRun(
  db: SqlQuery,
  run: AgentRunRow,
  opts: {
    publish: ProcessRunPublish;
    createSession?: typeof createCoResearchAgentSession;
    host?: ResearchToolHost;
    model?: SessionModel;
    workerId?: string;
    heartbeatMs?: number;
    cancelPollMs?: number;
  },
): Promise<void> {
  if (run.cancelRequested) {
    await markRun(db, run.id, "cancelled");
    await opts.publish(run.id, { type: "run.cancelled", payload: { runId: run.id } });
    return;
  }

  const host: ResearchToolHost = opts.host ?? {
    proposeCandidate: (input) =>
      proposeCandidate(db, {
        threadId: run.threadId,
        runId: run.id,
        kind: input.kind,
        payload: input.payload,
        rationale: input.rationale,
      }),
    proposeRevision: (input) =>
      proposeRevision(db, {
        projectId: run.projectId,
        entityId: input.entityId,
        baseStateRevision: input.baseStateRevision,
        kind: input.kind,
        changes: input.changes,
        rationale: input.rationale,
      }),
  };

  const createSession = opts.createSession ?? createCoResearchAgentSession;
  const entries = (await loadThreadEntries(db, run.threadId)) as
    | Parameters<typeof createCoResearchAgentSession>[0]["entries"]
    | undefined;

  const session = await createSession({
    model: opts.model ?? resolveSessionModel(),
    projectId: run.projectId,
    threadId: run.threadId,
    entries,
    host,
  });

  session.subscribe((event) => {
    const adapted = adaptPiEvent(event);
    if (adapted) void opts.publish(run.id, adapted);
  });

  const workerId = opts.workerId ?? run.leaseOwner;
  const timers: ReturnType<typeof setInterval>[] = [];
  let abortRequested = false;

  if (workerId) {
    timers.push(
      setInterval(() => {
        void heartbeatRun(db, run.id, workerId);
      }, opts.heartbeatMs ?? HEARTBEAT_MS),
    );
  }
  timers.push(
    setInterval(() => {
      void isCancelRequested(db, run.id).then((requested) => {
        if (!requested) return;
        abortRequested = true;
        abortSession(session);
      });
    }, opts.cancelPollMs ?? CANCEL_POLL_MS),
  );

  try {
    await session.prompt(run.prompt);
    if (abortRequested || (await isCancelRequested(db, run.id))) {
      await markRun(db, run.id, "cancelled");
      await opts.publish(run.id, { type: "run.cancelled", payload: { runId: run.id } });
      return;
    }
    const sessionEntries = session.sessionManager.getEntries() as unknown[];
    await persistSessionEntries(db, run.threadId, sessionEntries);
    await markRun(db, run.id, "completed");
    await opts.publish(run.id, { type: "run.completed", payload: { runId: run.id } });
  } catch (err) {
    if (abortRequested || (await isCancelRequested(db, run.id))) {
      await markRun(db, run.id, "cancelled");
      await opts.publish(run.id, { type: "run.cancelled", payload: { runId: run.id } });
      return;
    }
    await markRun(db, run.id, "failed");
    await opts.publish(run.id, {
      type: "run.failed",
      payload: { runId: run.id, error: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  } finally {
    for (const timer of timers) clearInterval(timer);
    session.dispose();
  }
}
