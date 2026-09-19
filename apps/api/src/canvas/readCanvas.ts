// Initial canvas load (docs/spec/02-api-contract.md §3).
// Assembles canvas_nodes × canvas_layout × canvas_edges. Projections and
// virtual relation edges land with ticket 06 (first crEntity on the board).

import type { CanvasSnapshot } from "@coresearch/shared";

import type { RequestDb } from "../db/index.js";
import { loadCanvasGraph, toWireNode } from "./state.js";

export type { CanvasSnapshot };

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

  return {
    canvasId: row.id,
    projectId: row.project_id,
    projectTitle: row.project_title,
    version: graph.version,
    nodes: graph.nodes.map(toWireNode),
    edges: graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    })),
  };
}
