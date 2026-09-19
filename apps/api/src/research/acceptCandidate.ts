// Candidate accept (ADR 0005 / docs/spec/02 §2).
//
// One withRequestContext transaction + withCanvasMutex:
//   recheck → entity+revision → system CREATE_NODES → persist → projection.
// The HTTP body never carries semantic content; we re-read the candidate
// from agent_messages. Repeat accepts hit UNIQUE(project_id,
// source_candidate_id) and return the first entityId.

import {
  canonicalizeDeltas,
  diffCanvasState,
  executeCanvasCommands,
  preAssignIds,
} from "@coresearch/engine";
import {
  contentHash,
  entityPresentation,
  parseCandidatePart,
  summaryFromPayload,
} from "@coresearch/research";
import type { AcceptCandidateResult } from "@coresearch/shared";

import { withCanvasMutex } from "../canvas/advisoryLock.js";
import { loadCanvasGraph, persistDeltas } from "../canvas/state.js";
import type { RequestDb } from "../db/index.js";

export type AcceptCandidateInput = {
  projectId: string;
  candidateId: string;
  canvasId: string;
  placement: {
    parentNodeId?: string;
    position: { x: number; y: number };
  };
  /** Test-only: throw after persist, before canvas_projections. */
  failBefore?: "projection";
};

export class AcceptNotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
    this.name = "AcceptNotFoundError";
  }
}

type EntityRow = {
  id: string;
  entity_kind: string;
  current_revision: number;
  content_hash: string;
  status: string;
  origin: string;
  confirmed: boolean;
  stale: string | null;
  summary: string | null;
  payload: unknown;
};

export async function acceptCandidate(
  db: RequestDb,
  input: AcceptCandidateInput,
): Promise<AcceptCandidateResult> {
  const candidate = await loadCandidate(db, input.projectId, input.candidateId);
  if (!candidate) throw new AcceptNotFoundError("candidate not found");

  return withCanvasMutex(db, input.canvasId, async () => {
    const existing = await existingMaterialization(
      db,
      input.projectId,
      input.candidateId,
    );
    if (existing) return existing;

    const graph = await loadCanvasGraph(db, input.canvasId);
    if (!graph) throw new AcceptNotFoundError("canvas not found");

    const canvasProject = await db.query<{ project_id: string }>(
      "SELECT project_id FROM canvases WHERE id = $1::uuid",
      [input.canvasId],
    );
    if (canvasProject.rows[0]?.project_id !== input.projectId) {
      throw new AcceptNotFoundError("canvas not found");
    }

    const hash = contentHash(candidate.payload);
    const summary = summaryFromPayload(candidate.payload);
    let entity: EntityRow;
    try {
      const inserted = await db.query<EntityRow>(
        `INSERT INTO research_entities (
           project_id, entity_kind, current_revision, content_hash,
           status, origin, confirmed, summary, payload, source_candidate_id
         ) VALUES (
           $1::uuid, $2::research_entity_kind, 1, $3,
           'proposed', 'agent', false, $4, $5::jsonb, $6::uuid
         )
         RETURNING id, entity_kind, current_revision, content_hash,
                   status, origin, confirmed, stale, summary, payload`,
        [
          input.projectId,
          candidate.kind,
          hash,
          summary,
          JSON.stringify(candidate.payload ?? {}),
          input.candidateId,
        ],
      );
      entity = inserted.rows[0]!;
    } catch {
      const raced = await existingMaterialization(
        db,
        input.projectId,
        input.candidateId,
      );
      if (raced) return raced;
      throw new Error("failed to insert research_entities");
    }

    await db.query(
      `INSERT INTO research_entity_revisions (
         entity_id, revision, payload, content_hash, created_by
       ) VALUES ($1::uuid, 1, $2::jsonb, $3, 'user')`,
      [entity.id, JSON.stringify(candidate.payload ?? {}), hash],
    );

    const assigned = preAssignIds(
      [
        {
          type: "CREATE_NODES",
          nodes: [
            {
              nodeType: "crEntity",
              position: input.placement.position,
              parentId: input.placement.parentNodeId,
              size: { width: 260, height: 140 },
              data: {},
            },
          ],
        },
      ],
      "system",
    );
    const output = executeCanvasCommands(
      { source: "system", commands: assigned },
      { nodes: graph.nodes, edges: graph.edges, canvasId: input.canvasId },
    );
    if (!output.commandResults[0]?.applied) {
      throw new Error(
        output.commandResults[0]?.reason ?? "CREATE_NODES was rejected",
      );
    }

    const created = output.writeResult.nodes.find(
      (n) => !graph.nodes.some((prev) => prev.id === n.id),
    );
    if (!created) throw new Error("CREATE_NODES produced no node");

    const presentation = entityPresentation({
      nodeId: created.id,
      entityId: entity.id,
      entityKind: candidate.kind,
      currentRevision: 1,
      contentHash: hash,
      status: entity.status,
      origin: entity.origin,
      confirmed: entity.confirmed,
      stale: entity.stale,
      summary: entity.summary,
      payload: entity.payload,
    });
    const painted = output.writeResult.nodes.map((n) =>
      n.id === created.id ? { ...n, data: presentation } : n,
    );

    const deltas = canonicalizeDeltas(
      diffCanvasState(
        { nodes: graph.nodes, edges: graph.edges },
        { nodes: painted, edges: output.writeResult.edges },
      ),
    );
    const toVersion = graph.version + 1;
    await persistDeltas(db, input.canvasId, graph.version, toVersion, deltas);

    if (input.failBefore === "projection") {
      throw new Error("test: fail before projection");
    }

    await db.query(
      `INSERT INTO canvas_projections (node_id, canvas_id, entity_id)
       VALUES ($1::uuid, $2::uuid, $3::uuid)`,
      [created.id, input.canvasId, entity.id],
    );

    return {
      entityId: entity.id,
      nodeId: created.id,
      alreadyMaterialized: false,
      version: toVersion,
      fromVersion: graph.version,
      deltas,
    };
  });
}

async function loadCandidate(
  db: RequestDb,
  projectId: string,
  candidateId: string,
) {
  const row = await db.query<{ id: string; payload: unknown }>(
    `SELECT m.id, m.payload
       FROM agent_messages m
       JOIN agent_threads t ON t.id = m.thread_id
      WHERE m.id = $1::uuid AND t.project_id = $2::uuid`,
    [candidateId, projectId],
  );
  if (!row.rows[0]) return null;
  return parseCandidatePart(row.rows[0].id, row.rows[0].payload);
}

async function existingMaterialization(
  db: RequestDb,
  projectId: string,
  candidateId: string,
): Promise<AcceptCandidateResult | null> {
  const entity = await db.query<{ id: string }>(
    `SELECT id FROM research_entities
      WHERE project_id = $1::uuid AND source_candidate_id = $2::uuid`,
    [projectId, candidateId],
  );
  const entityId = entity.rows[0]?.id;
  if (!entityId) return null;

  const projection = await db.query<{ node_id: string; canvas_id: string }>(
    `SELECT node_id, canvas_id FROM canvas_projections
      WHERE entity_id = $1::uuid
      LIMIT 1`,
    [entityId],
  );
  const canvas = await db.query<{ version: string | number }>(
    "SELECT version FROM canvases WHERE id = $1::uuid",
    [projection.rows[0]?.canvas_id],
  );
  const version = Number(canvas.rows[0]?.version ?? 0);
  return {
    entityId,
    nodeId: projection.rows[0]?.node_id ?? "",
    alreadyMaterialized: true,
    version,
    fromVersion: version,
    deltas: [],
  };
}
