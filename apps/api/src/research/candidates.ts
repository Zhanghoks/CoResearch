// Fixture insert + list for ticket 06 (no Agent Worker yet).
// The row shape is the same SessionEntry CustomMessage that ticket 08
// will persist from Pi — accept re-reads it and does not trust the client.

import {
  fixtureSessionPayload,
  parseCandidatePart,
  type CandidatePart,
} from "@coresearch/research";
import { createUuid } from "@coresearch/shared";

import type { RequestDb } from "../db/index.js";

const FIXTURE_KIND = "direction" as const;
const FIXTURE_PAYLOAD = {
  title: "Attribution under uncertainty",
  summary:
    "How should a researcher attribute an outcome when prior edits in the same session change the next edit's effect?",
};

export async function listCandidates(
  db: RequestDb,
  projectId: string,
): Promise<CandidatePart[]> {
  const visible = await db.query<{ id: string }>(
    "SELECT id FROM projects WHERE id = $1::uuid",
    [projectId],
  );
  if (!visible.rows[0]) return [];

  const rows = await db.query<{ id: string; payload: unknown }>(
    `SELECT m.id, m.payload
       FROM agent_messages m
       JOIN agent_threads t ON t.id = m.thread_id
      WHERE t.project_id = $1::uuid
      ORDER BY m.created_at ASC`,
    [projectId],
  );
  const parts: CandidatePart[] = [];
  for (const row of rows.rows) {
    const part = parseCandidatePart(row.id, row.payload);
    if (part) parts.push(part);
  }
  return parts;
}

export async function insertFixtureCandidate(
  db: RequestDb,
  projectId: string,
): Promise<CandidatePart> {
  const visible = await db.query<{ id: string }>(
    "SELECT id FROM projects WHERE id = $1::uuid",
    [projectId],
  );
  if (!visible.rows[0]) {
    throw new ProjectNotFoundError();
  }

  let thread = await db.query<{ id: string }>(
    `SELECT id FROM agent_threads WHERE project_id = $1::uuid ORDER BY created_at LIMIT 1`,
    [projectId],
  );
  if (!thread.rows[0]) {
    thread = await db.query<{ id: string }>(
      `INSERT INTO agent_threads (project_id, pi_cwd)
       VALUES ($1::uuid, $2)
       RETURNING id`,
      [projectId, projectId],
    );
  }
  const threadId = thread.rows[0]!.id;
  const candidateId = createUuid();
  const payload = fixtureSessionPayload({
    candidateId,
    schemaVersion: 1,
    kind: FIXTURE_KIND,
    payload: FIXTURE_PAYLOAD,
    provenance: { runId: "fixture", messageId: candidateId },
  });

  await db.query(
    `INSERT INTO agent_messages (id, thread_id, entry_type, payload)
     VALUES ($1::uuid, $2::uuid, 'message', $3::jsonb)`,
    [candidateId, threadId, JSON.stringify(payload)],
  );

  const part = parseCandidatePart(candidateId, payload);
  if (!part) throw new Error("fixture payload failed to parse");
  return part;
}

export class ProjectNotFoundError extends Error {
  constructor() {
    super("project not found");
    this.name = "ProjectNotFoundError";
  }
}
