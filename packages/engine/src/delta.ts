// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
//
// Ported verbatim from Huabu-main/packages/shared/src/canvas-engine/delta.ts.
// Pure functions only — no host or network coupling.

import type { CanvasEdge, CanvasNode } from "./interfaces.js";

export type Delta =
  | { type: "INSERT_NODE"; node: CanvasNode }
  | { type: "DELETE_NODE"; node: CanvasNode }
  | { type: "REPLACE_NODE"; prev: CanvasNode; next: CanvasNode }
  | { type: "INSERT_EDGE"; edge: CanvasEdge }
  | { type: "DELETE_EDGE"; edge: CanvasEdge }
  | { type: "REPLACE_EDGE"; prev: CanvasEdge; next: CanvasEdge };

/**
 * Return the inverse of a single delta. Applying the inverse to a state
 * that already has the delta applied yields the original state.
 */
export function invertDelta(delta: Delta): Delta {
  switch (delta.type) {
    case "INSERT_NODE":
      return { type: "DELETE_NODE", node: delta.node };
    case "DELETE_NODE":
      return { type: "INSERT_NODE", node: delta.node };
    case "REPLACE_NODE":
      return { type: "REPLACE_NODE", prev: delta.next, next: delta.prev };
    case "INSERT_EDGE":
      return { type: "DELETE_EDGE", edge: delta.edge };
    case "DELETE_EDGE":
      return { type: "INSERT_EDGE", edge: delta.edge };
    case "REPLACE_EDGE":
      return { type: "REPLACE_EDGE", prev: delta.next, next: delta.prev };
  }
}

/**
 * Apply a delta list to a `{ nodes, edges }` snapshot, producing the next
 * snapshot. Pure — does not mutate the input arrays or their elements.
 * Unknown ids in `REPLACE_*`/`DELETE_*` are tolerated (skipped).
 */
export function applyDeltas(
  state: { nodes: readonly CanvasNode[]; edges: readonly CanvasEdge[] },
  deltas: readonly Delta[],
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const nodeMap = new Map<string, CanvasNode>(
    state.nodes.map((n) => [n.id, n]),
  );
  const edgeMap = new Map<string, CanvasEdge>(
    state.edges.map((e) => [e.id, e]),
  );

  for (const delta of deltas) {
    switch (delta.type) {
      case "INSERT_NODE":
        nodeMap.set(delta.node.id, delta.node);
        break;
      case "DELETE_NODE":
        nodeMap.delete(delta.node.id);
        break;
      case "REPLACE_NODE":
        if (nodeMap.has(delta.next.id)) {
          nodeMap.set(delta.next.id, delta.next);
        }
        break;
      case "INSERT_EDGE":
        edgeMap.set(delta.edge.id, delta.edge);
        break;
      case "DELETE_EDGE":
        edgeMap.delete(delta.edge.id);
        break;
      case "REPLACE_EDGE":
        if (edgeMap.has(delta.next.id)) {
          edgeMap.set(delta.next.id, delta.next);
        }
        break;
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}
