// Initial canvas load (docs/spec/02-api-contract.md §3).
//
// Ticket 04 only has to load an EMPTY canvas — nothing creates canvas
// nodes until ticket 05 (note editing) and ticket 06 (candidate
// acceptance / projections). So this reads the canvas identity and
// returns empty collections rather than pretending to assemble
// canvas_nodes × canvas_layout × canvas_projections × research_entities
// and the virtual relation edges; that assembly lands with the slice that
// first puts a node on the board.
//
// Returns null when the canvas is not visible to the caller. RLS already
// filters the row out, so "someone else's canvas" and "no such canvas"
// are indistinguishable here by construction — the route turns both into
// 404 so we never confirm that an id exists.

import type { RequestDb } from "../db/index.js";

export type CanvasSnapshot = {
  canvasId: string;
  projectId: string;
  title: string;
  /**
   * The owning project's title. Carried here so a deep link to
   * /canvas/:canvasId renders its header on a cold load, without the
   * client having to hold state from the project list it may never
   * have visited.
   */
  projectTitle: string;
  version: number;
  nodes: never[];
  edges: never[];
};

export async function readCanvas(
  db: RequestDb,
  canvasId: string,
): Promise<CanvasSnapshot | null> {
  const result = await db.query<{
    id: string;
    project_id: string;
    title: string;
    project_title: string;
    version: string | number;
  }>(
    `SELECT c.id, c.project_id, c.title, c.version, p.title AS project_title
       FROM canvases c
       JOIN projects p ON p.id = c.project_id
      WHERE c.id = $1::uuid`,
    [canvasId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    canvasId: row.id,
    projectId: row.project_id,
    title: row.title,
    projectTitle: row.project_title,
    // bigint arrives as a string over the wire; the canvas version is a
    // counter the client compares against delta versions, so it must be
    // a number on the JSON boundary.
    version: Number(row.version),
    nodes: [],
    edges: [],
  };
}
