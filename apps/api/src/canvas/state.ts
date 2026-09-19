// Load / persist the engine's {nodes, edges} against canvas_nodes +
// canvas_layout + canvas_edges. Deltas are the engine's coarse Delta
// list, stored as jsonb on canvas_deltas.

import {
  type CanvasEdge,
  type CanvasNode,
  type Delta,
} from "@coresearch/engine";
import type { WireCanvasNode } from "@coresearch/shared";

import type { RequestDb } from "../db/index.js";

type NodeRow = {
  id: string;
  node_type: string;
  parent_node_id: string | null;
  native_data: Record<string, unknown>;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  z_order: number;
};

type EdgeRow = {
  id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type: string;
};

export function toWireNode(node: CanvasNode): WireCanvasNode {
  const style = (node.style ?? {}) as { width?: number; height?: number };
  return {
    id: node.id,
    type: node.type ?? "note",
    position: node.position,
    parentId: node.parentId ?? null,
    data: (node.data ?? {}) as Record<string, unknown>,
    width: style.width ?? null,
    height: style.height ?? null,
    zIndex: node.zIndex ?? null,
  };
}

export function fromWireNode(node: WireCanvasNode): CanvasNode {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    parentId: node.parentId ?? undefined,
    data: node.data,
    style: {
      ...(typeof node.width === "number" ? { width: node.width } : {}),
      ...(typeof node.height === "number" ? { height: node.height } : {}),
    },
    ...(node.zIndex != null ? { zIndex: node.zIndex } : {}),
  } as CanvasNode;
}

export async function loadCanvasGraph(
  db: RequestDb,
  canvasId: string,
): Promise<{ nodes: CanvasNode[]; edges: CanvasEdge[]; version: number } | null> {
  const canvas = await db.query<{ version: string | number }>(
    "SELECT version FROM canvases WHERE id = $1::uuid",
    [canvasId],
  );
  if (!canvas.rows[0]) return null;

  const nodes = await db.query<NodeRow>(
    `SELECT n.id, n.node_type, n.parent_node_id, n.native_data,
            l.x, l.y, l.width, l.height, l.z_order
       FROM canvas_nodes n
       JOIN canvas_layout l ON l.node_id = n.id
      WHERE n.canvas_id = $1::uuid`,
    [canvasId],
  );
  const edges = await db.query<EdgeRow>(
    `SELECT id, source_node_id, target_node_id, edge_type
       FROM canvas_edges
      WHERE canvas_id = $1::uuid`,
    [canvasId],
  );

  return {
    version: Number(canvas.rows[0].version),
    nodes: nodes.rows.map((row) =>
      fromWireNode({
        id: row.id,
        type: row.node_type,
        position: { x: row.x, y: row.y },
        parentId: row.parent_node_id,
        data: row.native_data,
        width: row.width,
        height: row.height,
        zIndex: row.z_order === 0 ? null : row.z_order,
      }),
    ),
    edges: edges.rows.map((row) => ({
      id: row.id,
      source: row.source_node_id,
      target: row.target_node_id,
    })) as CanvasEdge[],
  };
}

export async function persistDeltas(
  db: RequestDb,
  canvasId: string,
  fromVersion: number,
  toVersion: number,
  deltas: readonly Delta[],
): Promise<void> {
  const inserted = deltas.filter(
    (d): d is Extract<Delta, { type: "INSERT_NODE" }> => d.type === "INSERT_NODE",
  );
  for (const delta of inserted) {
    await insertNode(db, canvasId, delta.node, { deferParent: true });
  }
  for (const delta of inserted) {
    const parentId = delta.node.parentId ?? null;
    if (parentId) {
      await db.query(
        "UPDATE canvas_nodes SET parent_node_id = $2::uuid WHERE id = $1::uuid",
        [delta.node.id, parentId],
      );
    }
  }

  for (const delta of deltas) {
    switch (delta.type) {
      case "INSERT_NODE":
        break;
      case "DELETE_NODE":
        await db.query("DELETE FROM canvas_nodes WHERE id = $1::uuid", [
          delta.node.id,
        ]);
        break;
      case "REPLACE_NODE":
        await replaceNode(db, canvasId, delta.next);
        break;
      case "INSERT_EDGE":
        await db.query(
          `INSERT INTO canvas_edges (id, canvas_id, source_node_id, target_node_id, edge_type, created_by)
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'visual', 'user')`,
          [delta.edge.id, canvasId, delta.edge.source, delta.edge.target],
        );
        break;
      case "DELETE_EDGE":
        await db.query("DELETE FROM canvas_edges WHERE id = $1::uuid", [
          delta.edge.id,
        ]);
        break;
      case "REPLACE_EDGE":
        await db.query(
          `UPDATE canvas_edges
              SET source_node_id = $2::uuid, target_node_id = $3::uuid
            WHERE id = $1::uuid`,
          [delta.next.id, delta.next.source, delta.next.target],
        );
        break;
    }
  }

  // Compare-and-swap on the version we read, and CHECK that it matched.
  // `RETURNING` + `rows.length` rather than a rowcount because the two
  // drivers disagree: node-postgres reports `rowCount`, PGlite reports
  // `affectedRows`, and reading the wrong one yields `undefined` — which
  // is exactly how this check would silently pass while never firing.
  //
  // Throwing rolls back the whole transaction (we are inside
  // withRequestContext), which is the point: the node writes above and
  // the delta row below must not survive a version they were not
  // computed against, or the log would permanently describe a canvas
  // state that never existed and every catch-up would replay it.
  const swapped = await db.query<{ id: string }>(
    `UPDATE canvases SET version = $2
      WHERE id = $1::uuid AND version = $3
      RETURNING id`,
    [canvasId, toVersion, fromVersion],
  );
  if (swapped.rows.length === 0) {
    throw new Error(
      `canvas ${canvasId}: version moved from ${fromVersion} while the batch was being applied`,
    );
  }

  await db.query(
    `INSERT INTO canvas_deltas (canvas_id, from_version, to_version, deltas)
     VALUES ($1::uuid, $2, $3, $4::jsonb)`,
    [canvasId, fromVersion, toVersion, JSON.stringify(deltas)],
  );
}

async function insertNode(
  db: RequestDb,
  canvasId: string,
  node: CanvasNode,
  opts: { deferParent?: boolean } = {},
): Promise<void> {
  const wire = toWireNode(node);
  await db.query(
    `INSERT INTO canvas_nodes (id, canvas_id, node_type, parent_node_id, native_data)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb)`,
    [
      wire.id,
      canvasId,
      wire.type,
      opts.deferParent ? null : (wire.parentId ?? null),
      JSON.stringify(wire.data),
    ],
  );
  await db.query(
    `INSERT INTO canvas_layout (node_id, x, y, width, height, z_order)
     VALUES ($1::uuid, $2, $3, $4, $5, $6)`,
    [
      wire.id,
      wire.position.x,
      wire.position.y,
      wire.width,
      wire.height,
      wire.zIndex ?? 0,
    ],
  );
}

async function replaceNode(
  db: RequestDb,
  canvasId: string,
  node: CanvasNode,
): Promise<void> {
  const wire = toWireNode(node);
  await db.query(
    `UPDATE canvas_nodes
        SET node_type = $2, parent_node_id = $3, native_data = $4::jsonb, updated_at = now()
      WHERE id = $1::uuid AND canvas_id = $5::uuid`,
    [
      wire.id,
      wire.type,
      wire.parentId ?? null,
      JSON.stringify(wire.data),
      canvasId,
    ],
  );
  await db.query(
    `UPDATE canvas_layout
        SET x = $2, y = $3, width = $4, height = $5, z_order = $6
      WHERE node_id = $1::uuid`,
    [
      wire.id,
      wire.position.x,
      wire.position.y,
      wire.width,
      wire.height,
      wire.zIndex ?? 0,
    ],
  );
}
