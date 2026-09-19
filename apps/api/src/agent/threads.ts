// Agent threads / runs / durable messages (docs/spec/02 §4).

import type { AgentMessageList, CreatedRun, CreatedThread } from "@coresearch/shared";

import type { RequestDb } from "../db/index.js";

export class ThreadNotFoundError extends Error {
  constructor() {
    super("thread not found");
    this.name = "ThreadNotFoundError";
  }
}

export async function createThread(
  db: RequestDb,
  projectId: string,
): Promise<CreatedThread | null> {
  const visible = await db.query<{ id: string }>(
    "SELECT id FROM projects WHERE id = $1::uuid",
    [projectId],
  );
  if (!visible.rows[0]) return null;

  const inserted = await db.query<{ id: string }>(
    `INSERT INTO agent_threads (project_id, pi_cwd)
     VALUES ($1::uuid, $2)
     RETURNING id`,
    [projectId, projectId],
  );
  return { threadId: inserted.rows[0]!.id };
}

export async function createRun(
  db: RequestDb,
  threadId: string,
  prompt: string,
): Promise<CreatedRun | null> {
  const thread = await db.query<{ id: string; project_id: string }>(
    "SELECT id, project_id FROM agent_threads WHERE id = $1::uuid",
    [threadId],
  );
  if (!thread.rows[0]) return null;

  const inserted = await db.query<{ id: string }>(
    `INSERT INTO agent_runs (thread_id, project_id, status, prompt)
     VALUES ($1::uuid, $2::uuid, 'queued', $3)
     RETURNING id`,
    [threadId, thread.rows[0].project_id, prompt],
  );
  return {
    runId: inserted.rows[0]!.id,
    threadId,
    status: "queued",
  };
}

export async function listThreadMessages(
  db: RequestDb,
  threadId: string,
): Promise<AgentMessageList | null> {
  const thread = await db.query<{ id: string }>(
    "SELECT id FROM agent_threads WHERE id = $1::uuid",
    [threadId],
  );
  if (!thread.rows[0]) return null;

  const rows = await db.query<{
    id: string;
    parent_id: string | null;
    entry_type: string;
    payload: unknown;
    created_at: Date | string;
  }>(
    `SELECT id, parent_id, entry_type, payload, created_at
       FROM agent_messages
      WHERE thread_id = $1::uuid
      ORDER BY created_at ASC`,
    [threadId],
  );
  return {
    messages: rows.rows.map((row) => ({
      id: row.id,
      parentId: row.parent_id,
      entryType: row.entry_type,
      payload: row.payload,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
    })),
  };
}

export async function runVisibleToUser(
  db: RequestDb,
  runId: string,
): Promise<boolean> {
  const row = await db.query<{ id: string }>(
    "SELECT id FROM agent_runs WHERE id = $1::uuid",
    [runId],
  );
  return Boolean(row.rows[0]);
}
