// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
//
// Ported verbatim from Huabu-main/packages/shared/src/canvas-engine/diff.ts.
// Used by the host (apps/api's executor-host, ticket 03+) to derive the
// Delta list that travels to `canvas_deltas` / Realtime after a server-side
// batch run.

import type { Delta } from "./delta.js";
import type { CanvasEdge, CanvasNode } from "./interfaces.js";

/**
 * Top-level React Flow runtime fields — selection/drag/measurement
 * bookkeeping the renderer writes onto every node/edge. Not authored
 * content; must be ignored when deciding whether a node/edge actually
 * changed.
 */
export const TRANSIENT_NODE_FIELDS = [
  "selected",
  "dragging",
  "measured",
  "resizing",
] as const;

export const TRANSIENT_EDGE_FIELDS = ["selected"] as const;

export function stripTransientNodeFields<T extends object>(node: T): T {
  const out = { ...node } as Record<string, unknown>;
  for (const k of TRANSIENT_NODE_FIELDS) delete out[k];
  return out as T;
}

export function stripTransientEdgeFields<T extends object>(edge: T): T {
  const out = { ...edge } as Record<string, unknown>;
  for (const k of TRANSIENT_EDGE_FIELDS) delete out[k];
  return out as T;
}

/**
 * Compute the coarse delta list that transforms `prev` into `next`.
 * Output ordering: deletes first, then inserts, then replaces.
 */
export function diffCanvasState(
  prev: { nodes: readonly CanvasNode[]; edges: readonly CanvasEdge[] },
  next: { nodes: readonly CanvasNode[]; edges: readonly CanvasEdge[] },
): Delta[] {
  const out: Delta[] = [];

  const prevNodeMap = new Map<string, CanvasNode>(
    prev.nodes.map((n) => [n.id, n]),
  );
  const nextNodeMap = new Map<string, CanvasNode>(
    next.nodes.map((n) => [n.id, n]),
  );

  for (const [id, node] of prevNodeMap) {
    if (!nextNodeMap.has(id)) out.push({ type: "DELETE_NODE", node });
  }
  for (const [id, node] of nextNodeMap) {
    if (!prevNodeMap.has(id)) out.push({ type: "INSERT_NODE", node });
  }
  for (const [id, nextNode] of nextNodeMap) {
    const prevNode = prevNodeMap.get(id);
    if (!prevNode) continue;
    if (Object.is(prevNode, nextNode)) continue;
    if (nodesEqual(prevNode, nextNode)) continue;
    out.push({ type: "REPLACE_NODE", prev: prevNode, next: nextNode });
  }

  const prevEdgeMap = new Map<string, CanvasEdge>(
    prev.edges.map((e) => [e.id, e]),
  );
  const nextEdgeMap = new Map<string, CanvasEdge>(
    next.edges.map((e) => [e.id, e]),
  );

  for (const [id, edge] of prevEdgeMap) {
    if (!nextEdgeMap.has(id)) out.push({ type: "DELETE_EDGE", edge });
  }
  for (const [id, edge] of nextEdgeMap) {
    if (!prevEdgeMap.has(id)) out.push({ type: "INSERT_EDGE", edge });
  }
  for (const [id, nextEdge] of nextEdgeMap) {
    const prevEdge = prevEdgeMap.get(id);
    if (!prevEdge) continue;
    if (Object.is(prevEdge, nextEdge)) continue;
    if (edgesEqual(prevEdge, nextEdge)) continue;
    out.push({ type: "REPLACE_EDGE", prev: prevEdge, next: nextEdge });
  }

  return out;
}

function nodesEqual(a: CanvasNode, b: CanvasNode): boolean {
  if (a.id !== b.id) return false;
  if (a.type !== b.type) return false;
  if (a.parentId !== b.parentId) return false;
  if (a.position?.x !== b.position?.x) return false;
  if (a.position?.y !== b.position?.y) return false;
  return (
    safeStringify(stripTransientNodeFields(a)) ===
    safeStringify(stripTransientNodeFields(b))
  );
}

function edgesEqual(a: CanvasEdge, b: CanvasEdge): boolean {
  if (a.id !== b.id) return false;
  if (a.source !== b.source) return false;
  if (a.target !== b.target) return false;
  if (a.sourceHandle !== b.sourceHandle) return false;
  if (a.targetHandle !== b.targetHandle) return false;
  return (
    safeStringify(stripTransientEdgeFields(a)) ===
    safeStringify(stripTransientEdgeFields(b))
  );
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return Math.random().toString(36);
  }
}
