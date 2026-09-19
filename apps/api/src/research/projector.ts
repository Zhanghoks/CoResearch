// Canvas projection reconciler (docs/spec/04-research-domain-service.md §6).
//
// Ticket 07 only needs "entity revision changed → refresh the same nodeId,
// do not touch canvas_layout, do not insert a second canvas_nodes row".
// Creates/deletes wait for a later slice. Refresh is signaled by
// canvas_projections.projector_version !== research_entities.current_revision.

import {
  canonicalizeDeltas,
  diffCanvasState,
  executeCanvasCommands,
} from "@coresearch/engine";
import {
  entityPresentation,
  executeAsProjector,
  isResearchEntityKind,
  type ProjectionPlan,
} from "@coresearch/research";

import { withCanvasMutex } from "../canvas/advisoryLock.js";
import { loadCanvasGraph, persistDeltas } from "../canvas/state.js";
import type { RequestDb } from "../db/index.js";

type BindingRow = {
  node_id: string;
  entity_id: string;
  projector_version: number;
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

async function loadBindings(
  db: RequestDb,
  canvasId: string,
): Promise<BindingRow[]> {
  const rows = await db.query<BindingRow>(
    `SELECT p.node_id, p.entity_id, p.projector_version,
            e.entity_kind, e.current_revision, e.content_hash, e.status,
            e.origin, e.confirmed, e.stale, e.summary, e.payload
       FROM canvas_projections p
       JOIN research_entities e ON e.id = p.entity_id
      WHERE p.canvas_id = $1::uuid
      ORDER BY e.created_at ASC, e.id ASC`,
    [canvasId],
  );
  return rows.rows;
}

export async function planProjection(
  db: RequestDb,
  canvasId: string,
): Promise<ProjectionPlan> {
  const bindings = await loadBindings(db, canvasId);
  const mergePatches = bindings
    .filter((b) => b.projector_version !== b.current_revision)
    .flatMap((b) => {
      if (!isResearchEntityKind(b.entity_kind)) return [];
      return [
        {
          nodeId: b.node_id,
          patch: entityPresentation({
            nodeId: b.node_id,
            entityId: b.entity_id,
            entityKind: b.entity_kind,
            currentRevision: b.current_revision,
            contentHash: b.content_hash,
            status: b.status,
            origin: b.origin,
            confirmed: b.confirmed,
            stale: b.stale,
            summary: b.summary,
            payload: b.payload,
          }),
        },
      ];
    });

  return {
    canvasId,
    createInputs: [],
    deleteNodeIds: [],
    mergePatches,
    connectInputs: [],
  };
}

export async function reconcileProjectionOnce(
  db: RequestDb,
  canvasId: string,
): Promise<void> {
  await withCanvasMutex(db, canvasId, async () => {
    const plan = await planProjection(db, canvasId);
    const result = await executeAsProjector(
      { applyPlan: (next) => applyPlan(db, next) },
      plan,
    );
    if (!result.applied && plan.mergePatches.length > 0) {
      throw new Error(result.reason ?? "projector plan was rejected");
    }

    const leftovers = await planProjection(db, canvasId);
    if (leftovers.mergePatches.length > 0) {
      throw new Error("projector re-plan was not empty");
    }
  });
}

async function applyPlan(
  db: RequestDb,
  plan: ProjectionPlan,
): Promise<{ applied: boolean; reason?: string }> {
  if (
    plan.createInputs.length === 0 &&
    plan.deleteNodeIds.length === 0 &&
    plan.mergePatches.length === 0
  ) {
    return { applied: true };
  }

  const graph = await loadCanvasGraph(db, plan.canvasId);
  if (!graph) return { applied: false, reason: "canvas not found" };

  const commands = [];
  if (plan.deleteNodeIds.length > 0) {
    commands.push({ type: "DELETE_NODES" as const, nodeIds: plan.deleteNodeIds });
  }
  if (plan.createInputs.length > 0) {
    commands.push({ type: "CREATE_NODES" as const, nodes: plan.createInputs });
  }
  if (plan.mergePatches.length > 0) {
    commands.push({
      type: "MERGE_NODE_DATA" as const,
      patches: plan.mergePatches,
    });
  }

  const output = executeCanvasCommands(
    { source: "system", commands },
    { nodes: graph.nodes, edges: graph.edges, canvasId: plan.canvasId },
  );
  const rejected = output.commandResults.find((r) => !r.applied);
  if (rejected) {
    return { applied: false, reason: rejected.reason };
  }

  const deltas = canonicalizeDeltas(
    diffCanvasState(
      { nodes: graph.nodes, edges: graph.edges },
      {
        nodes: output.writeResult.nodes,
        edges: output.writeResult.edges,
      },
    ),
  );
  if (deltas.length > 0) {
    await persistDeltas(
      db,
      plan.canvasId,
      graph.version,
      graph.version + 1,
      deltas,
    );
  }

  for (const patch of plan.mergePatches) {
    await db.query(
      `UPDATE canvas_projections p
          SET projector_version = e.current_revision
         FROM research_entities e
        WHERE p.node_id = $1::uuid
          AND p.entity_id = e.id`,
      [patch.nodeId],
    );
  }

  return { applied: true };
}
