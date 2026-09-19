// Track B accept (docs/spec/02 §2 / ADR 0004).
// CAS on base_state_revision, apply changes, bump current_revision,
// then refresh existing projections — never CREATE_NODES.

import {
  ProposalConflictError,
  ProposalNotFoundError,
  applyProposalChanges,
  nextRevisionFields,
  parseProposalChanges,
} from "@coresearch/research";
import type { AcceptProposalResult } from "@coresearch/shared";

import type { RequestDb } from "../db/index.js";
import { reconcileProjectionOnce } from "./projector.js";

export { ProposalConflictError, ProposalNotFoundError };

export async function acceptProposal(
  db: RequestDb,
  proposalId: string,
): Promise<AcceptProposalResult> {
  const loaded = await db.query<{
    id: string;
    project_id: string;
    entity_id: string;
    base_state_revision: number;
    kind: string;
    changes: unknown;
    rationale: string | null;
    status: string;
    created_at: Date | string;
    current_revision: number;
    payload: unknown;
  }>(
    `SELECT p.id, p.project_id, p.entity_id, p.base_state_revision, p.kind,
            p.changes, p.rationale, p.status, p.created_at,
            e.current_revision, e.payload
       FROM proposals p
       JOIN research_entities e ON e.id = p.entity_id
      WHERE p.id = $1::uuid`,
    [proposalId],
  );
  const row = loaded.rows[0];
  if (!row) throw new ProposalNotFoundError();

  if (row.status === "accepted") {
    const projection = await existingNode(db, row.entity_id);
    return {
      proposalId: row.id,
      entityId: row.entity_id,
      revision: Number(row.current_revision),
      nodeId: projection,
    };
  }
  if (row.status !== "pending") {
    throw new Error(`proposal is ${row.status}`);
  }

  const currentRevision = Number(row.current_revision);
  const baseStateRevision = Number(row.base_state_revision);
  if (baseStateRevision !== currentRevision) {
    throw new ProposalConflictError(currentRevision, baseStateRevision);
  }

  const changes = parseProposalChanges(row.changes);
  const nextPayload = applyProposalChanges(row.payload, changes);
  const fields = nextRevisionFields(nextPayload);
  const nextRevision = currentRevision + 1;

  await db.query(
    `UPDATE research_entities
        SET current_revision = $2,
            payload = $3::jsonb,
            content_hash = $4,
            summary = $5,
            updated_at = now()
      WHERE id = $1::uuid`,
    [row.entity_id, nextRevision, JSON.stringify(fields.payload), fields.hash, fields.summary],
  );
  await db.query(
    `INSERT INTO research_entity_revisions (
       entity_id, revision, payload, content_hash, created_by
     ) VALUES ($1::uuid, $2, $3::jsonb, $4, 'agent-proposal-accepted')`,
    [row.entity_id, nextRevision, JSON.stringify(fields.payload), fields.hash],
  );
  await db.query(
    `UPDATE proposals SET status = 'accepted' WHERE id = $1::uuid`,
    [proposalId],
  );

  const canvases = await db.query<{ canvas_id: string; node_id: string }>(
    `SELECT canvas_id, node_id FROM canvas_projections
      WHERE entity_id = $1::uuid`,
    [row.entity_id],
  );
  for (const binding of canvases.rows) {
    await reconcileProjectionOnce(db, binding.canvas_id);
  }

  return {
    proposalId: row.id,
    entityId: row.entity_id,
    revision: nextRevision,
    nodeId: canvases.rows[0]?.node_id ?? null,
  };
}

async function existingNode(
  db: RequestDb,
  entityId: string,
): Promise<string | null> {
  const row = await db.query<{ node_id: string }>(
    `SELECT node_id FROM canvas_projections WHERE entity_id = $1::uuid LIMIT 1`,
    [entityId],
  );
  return row.rows[0]?.node_id ?? null;
}
