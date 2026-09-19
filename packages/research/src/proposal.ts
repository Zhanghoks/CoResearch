// Track B (docs/spec/04 §4 / ADR 0004).
// proposeRevision writes a pending proposals row. Accept lives in the
// API so it can reuse the canvas projector. Reject only flips status.

import { createUuid } from "@coresearch/shared";

import { contentHash, summaryFromPayload } from "./candidate.js";
import type { SqlQuery } from "./sql.js";

export const PROPOSAL_KINDS = [
  "clarification",
  "problem",
  "hypothesis",
  "revision",
  "pivot",
  "direction",
  "approach",
  "research_question",
] as const;

export type ProposalKind = (typeof PROPOSAL_KINDS)[number];

export type ProposalChange = {
  target: string;
  beforeStatementId: string | null;
  after: unknown;
};

export type ProposalRecord = {
  id: string;
  projectId: string;
  entityId: string;
  baseStateRevision: number;
  kind: ProposalKind;
  changes: ProposalChange[];
  rationale: string | null;
  status: "pending" | "accepted" | "rejected" | "superseded";
  createdAt: string;
};

export function isProposalKind(value: unknown): value is ProposalKind {
  return (
    typeof value === "string" &&
    (PROPOSAL_KINDS as readonly string[]).includes(value)
  );
}

export function parseProposalChanges(value: unknown): ProposalChange[] {
  if (!Array.isArray(value)) {
    throw new Error("proposal changes must be an array");
  }
  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`proposal change ${index} must be an object`);
    }
    const rec = item as Record<string, unknown>;
    if (typeof rec.target !== "string" || !rec.target.trim()) {
      throw new Error(`proposal change ${index} needs a target`);
    }
    return {
      target: rec.target,
      beforeStatementId:
        typeof rec.beforeStatementId === "string" ? rec.beforeStatementId : null,
      after: rec.after,
    };
  });
}

/** Apply an explicit diff onto the current entity payload. */
export function applyProposalChanges(
  payload: unknown,
  changes: ProposalChange[],
): Record<string, unknown> {
  const next: Record<string, unknown> =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? { ...(payload as Record<string, unknown>) }
      : {};
  for (const change of changes) {
    const after = change.after;
    if (after && typeof after === "object" && !Array.isArray(after)) {
      const rec = after as Record<string, unknown>;
      if (typeof rec.text === "string") {
        next[change.target] = rec.text;
        continue;
      }
    }
    next[change.target] = after;
  }
  return next;
}

export function nextRevisionFields(payload: unknown): {
  payload: Record<string, unknown>;
  hash: string;
  summary: string | null;
} {
  const next =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  return {
    payload: next,
    hash: contentHash(next),
    summary: summaryFromPayload(next),
  };
}

export class ProposalNotFoundError extends Error {
  constructor(message = "proposal not found") {
    super(message);
    this.name = "ProposalNotFoundError";
  }
}

export class ProposalConflictError extends Error {
  readonly currentRevision: number;
  readonly baseStateRevision: number;
  constructor(currentRevision: number, baseStateRevision: number) {
    super("revision conflict");
    this.name = "ProposalConflictError";
    this.currentRevision = currentRevision;
    this.baseStateRevision = baseStateRevision;
  }
}

export type ProposeRevisionInput = {
  projectId: string;
  entityId: string;
  baseStateRevision: number;
  kind: unknown;
  changes: unknown;
  rationale?: string;
};

export async function proposeRevision(
  db: SqlQuery,
  input: ProposeRevisionInput,
): Promise<{ proposalId: string }> {
  if (!isProposalKind(input.kind)) {
    throw new Error(`invalid proposal kind: ${String(input.kind)}`);
  }
  const changes = parseProposalChanges(input.changes);
  const entity = await db.query(
    `SELECT id, current_revision FROM research_entities
      WHERE id = $1::uuid AND project_id = $2::uuid`,
    [input.entityId, input.projectId],
  );
  if (!entity.rows[0]) {
    throw new ProposalNotFoundError("entity not found");
  }

  const proposalId = createUuid();
  await db.query(
    `INSERT INTO proposals (
       id, project_id, entity_id, base_state_revision, kind,
       changes, rationale, status
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $4, $5, $6::jsonb, $7, 'pending'
     )`,
    [
      proposalId,
      input.projectId,
      input.entityId,
      input.baseStateRevision,
      input.kind,
      JSON.stringify(changes),
      input.rationale ?? null,
    ],
  );
  return { proposalId };
}

export async function listProposals(
  db: SqlQuery,
  projectId: string,
  status?: string,
): Promise<ProposalRecord[]> {
  const visible = await db.query(
    "SELECT id FROM projects WHERE id = $1::uuid",
    [projectId],
  );
  if (!visible.rows[0]) return [];

  const rows = status
    ? await db.query(
        `SELECT id, project_id, entity_id, base_state_revision, kind,
                changes, rationale, status, created_at
           FROM proposals
          WHERE project_id = $1::uuid AND status = $2
          ORDER BY created_at ASC`,
        [projectId, status],
      )
    : await db.query(
        `SELECT id, project_id, entity_id, base_state_revision, kind,
                changes, rationale, status, created_at
           FROM proposals
          WHERE project_id = $1::uuid
          ORDER BY created_at ASC`,
        [projectId],
      );
  return rows.rows.map(rowToProposal);
}

export async function rejectProposal(
  db: SqlQuery,
  proposalId: string,
): Promise<ProposalRecord> {
  const existing = await db.query(
    `SELECT id, project_id, entity_id, base_state_revision, kind,
            changes, rationale, status, created_at
       FROM proposals WHERE id = $1::uuid`,
    [proposalId],
  );
  const row = existing.rows[0];
  if (!row) throw new ProposalNotFoundError();
  if (String(row.status) === "rejected") {
    return rowToProposal(row);
  }
  if (String(row.status) !== "pending") {
    throw new Error(`proposal is ${String(row.status)}`);
  }
  const updated = await db.query(
    `UPDATE proposals SET status = 'rejected'
      WHERE id = $1::uuid AND status = 'pending'
      RETURNING id, project_id, entity_id, base_state_revision, kind,
                changes, rationale, status, created_at`,
    [proposalId],
  );
  return rowToProposal(updated.rows[0] ?? row);
}

function rowToProposal(row: Record<string, unknown>): ProposalRecord {
  const created = row.created_at;
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    entityId: String(row.entity_id),
    baseStateRevision: Number(row.base_state_revision),
    kind: String(row.kind) as ProposalKind,
    changes: parseProposalChanges(row.changes),
    rationale: typeof row.rationale === "string" ? row.rationale : null,
    status: String(row.status) as ProposalRecord["status"],
    createdAt:
      created instanceof Date ? created.toISOString() : String(created ?? ""),
  };
}
