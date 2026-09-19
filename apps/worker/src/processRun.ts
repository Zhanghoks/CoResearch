// One claimed run: subscribe → prompt → persist completed SessionEntry
// rows only (docs/spec/05 §3). Token deltas go through publish, never
// agent_messages.

import {
  persistSessionEntries,
  proposeCandidate,
  type SqlQuery,
} from "@coresearch/research";

import { adaptPiEvent, type AdaptedEvent } from "./adaptPiEvent.js";
import {
  createCoResearchAgentSession,
  stubSessionModel,
  type ResearchToolHost,
  type SessionModel,
} from "./createCoResearchAgentSession.js";

export type AgentRunRow = {
  id: string;
  threadId: string;
  projectId: string;
  prompt: string;
  cancelRequested: boolean;
};

export type ProcessRunPublish = (
  runId: string,
  event: AdaptedEvent,
) => Promise<void>;

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
    /** Defaults to the stub model so the factory can boot without a provider key. */
    model?: SessionModel;
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
  };

  const createSession = opts.createSession ?? createCoResearchAgentSession;
  const entries = (await loadThreadEntries(db, run.threadId)) as
    | Parameters<typeof createCoResearchAgentSession>[0]["entries"]
    | undefined;

  const session = await createSession({
    model: opts.model ?? stubSessionModel(),
    projectId: run.projectId,
    threadId: run.threadId,
    entries,
    host,
  });

  session.subscribe((event) => {
    const adapted = adaptPiEvent(event);
    if (adapted) void opts.publish(run.id, adapted);
  });

  try {
    await session.prompt(run.prompt);
    const sessionEntries = session.sessionManager.getEntries() as unknown[];
    await persistSessionEntries(db, run.threadId, sessionEntries);
    await markRun(db, run.id, "completed");
    await opts.publish(run.id, { type: "run.completed", payload: { runId: run.id } });
  } catch (err) {
    await markRun(db, run.id, "failed");
    await opts.publish(run.id, {
      type: "run.failed",
      payload: { runId: run.id, error: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  } finally {
    session.dispose();
  }
}

async function markRun(
  db: SqlQuery,
  runId: string,
  status: "completed" | "failed" | "cancelled",
): Promise<void> {
  await db.query(
    `UPDATE agent_runs
        SET status = $2, ended_at = now()
      WHERE id = $1::uuid`,
    [runId, status],
  );
}

export async function claimNextRun(
  db: SqlQuery,
  workerId: string,
): Promise<AgentRunRow | null> {
  const claimed = await db.query(
    `UPDATE agent_runs
        SET status = 'running',
            lease_owner = $1,
            lease_expires_at = now() + interval '45 seconds',
            heartbeat_at = now(),
            started_at = coalesce(started_at, now())
      WHERE id = (
        SELECT id FROM agent_runs
         WHERE status = 'queued'
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1
      )
      RETURNING id, thread_id, project_id, prompt, cancel_requested`,
    [workerId],
  );
  const row = claimed.rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    threadId: String(row.thread_id),
    projectId: String(row.project_id),
    prompt: typeof row.prompt === "string" ? row.prompt : "",
    cancelRequested: Boolean(row.cancel_requested),
  };
}
