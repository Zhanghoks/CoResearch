// Initial canvas load (docs/spec/02-api-contract.md §3).
// Assembles canvas_nodes × canvas_layout × canvas_edges, then overlays
// research_entities through canvas_projections so a crEntity paints
// current semantics without those fields living in native_data.

import {
  entityPresentation,
  isResearchEntityKind,
} from "@coresearch/research";
import type { CanvasSnapshot, WireCanvasNode } from "@coresearch/shared";

import type { RequestDb } from "../db/index.js";
import { loadCanvasGraph, toWireNode } from "./state.js";

export type { CanvasSnapshot };

type ProjectionRow = {
  node_id: string;
  entity_id: string;
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

export async function readCanvas(
  db: RequestDb,
  canvasId: string,
): Promise<CanvasSnapshot | null> {
  const identity = await db.query<{
    id: string;
    project_id: string;
    project_title: string;
  }>(
    `SELECT c.id, c.project_id, p.title AS project_title
       FROM canvases c
       JOIN projects p ON p.id = c.project_id
      WHERE c.id = $1::uuid`,
    [canvasId],
  );
  const row = identity.rows[0];
  if (!row) return null;

  const graph = await loadCanvasGraph(db, canvasId);
  if (!graph) return null;

  const projections = await db.query<ProjectionRow>(
    `SELECT p.node_id, p.entity_id, e.entity_kind, e.current_revision,
            e.content_hash, e.status, e.origin, e.confirmed, e.stale,
            e.summary, e.payload
       FROM canvas_projections p
       JOIN research_entities e ON e.id = p.entity_id
      WHERE p.canvas_id = $1::uuid`,
    [canvasId],
  );
  const byNode = new Map(projections.rows.map((p) => [p.node_id, p]));

  const nodes: WireCanvasNode[] = graph.nodes.map((n) => {
    const wire = toWireNode(n);
    const proj = byNode.get(wire.id);
    if (!proj || wire.type !== "crEntity" || !isResearchEntityKind(proj.entity_kind)) {
      return wire;
    }
    return {
      ...wire,
      data: entityPresentation({
        nodeId: wire.id,
        entityId: proj.entity_id,
        entityKind: proj.entity_kind,
        currentRevision: proj.current_revision,
        contentHash: proj.content_hash,
        status: proj.status,
        origin: proj.origin,
        confirmed: proj.confirmed,
        stale: proj.stale,
        summary: proj.summary,
        payload: proj.payload,
        nativeData: wire.data,
      }),
    };
  });

  return {
    canvasId: row.id,
    projectId: row.project_id,
    projectTitle: row.project_title,
    version: graph.version,
    nodes,
    edges: graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    })),
  };
}
