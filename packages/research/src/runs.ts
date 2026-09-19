// Agent-run claim / lease / heartbeat / cancel (ticket 19 / 10).
// Postgres is the durable queue. SKIP LOCKED is the concurrency primitive.

import type { SqlQuery } from "./sql.js";

export const LEASE_SECONDS = 45;
export const HEARTBEAT_MS = 15_000;
export const CANCEL_POLL_MS = 2_000;

export type ClaimedRun = {
  id: string;
  threadId: string;
  projectId: string;
  prompt: string;
  cancelRequested: boolean;
  leaseOwner: string;
};

export async function claimNextRun(
  db: SqlQuery,
  workerId: string,
): Promise<ClaimedRun | null> {
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
            OR (status = 'running' AND lease_expires_at < now())
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1
      )
      RETURNING id, thread_id, project_id, prompt, cancel_requested, lease_owner`,
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
    leaseOwner: String(row.lease_owner ?? workerId),
  };
}

export async function heartbeatRun(
  db: SqlQuery,
  runId: string,
  workerId: string,
): Promise<boolean> {
  const updated = await db.query(
    `UPDATE agent_runs
        SET heartbeat_at = now(),
            lease_expires_at = now() + interval '45 seconds'
      WHERE id = $1::uuid AND lease_owner = $2
      RETURNING id`,
    [runId, workerId],
  );
  return Boolean(updated.rows[0]);
}

export async function isCancelRequested(
  db: SqlQuery,
  runId: string,
): Promise<boolean> {
  const row = await db.query(
    "SELECT cancel_requested FROM agent_runs WHERE id = $1::uuid",
    [runId],
  );
  return Boolean(row.rows[0]?.cancel_requested);
}

export async function requestRunCancel(
  db: SqlQuery,
  runId: string,
): Promise<boolean> {
  const updated = await db.query(
    `UPDATE agent_runs
        SET cancel_requested = true
      WHERE id = $1::uuid
      RETURNING id`,
    [runId],
  );
  return Boolean(updated.rows[0]);
}

export async function markRun(
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
