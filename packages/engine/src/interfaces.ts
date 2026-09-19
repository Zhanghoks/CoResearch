// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
//
// Ported from Huabu-main/packages/shared/src/canvas-engine/interfaces.ts.
// Type-only — no runtime code (deliberately not `runtime.ts`, matching
// Huabu's naming, to keep the "type-only vs runtime import" rule for
// `@xyflow/react` unambiguous).
//
// `PendingEffects` is trimmed to the fields ticket 02's CREATE_NODES/
// DELETE_NODES handlers actually populate. Huabu's `deferredFitFrameIds`
// (web-only, DOM-reflow driven) and note-provenance fields are dropped —
// they come back with the tickets that need frame fitting / MERGE_NODE_DATA.

import type { Node, Edge } from "@xyflow/react";

export type CanvasNode = Node;
export type CanvasEdge = Edge;

/** The minimal state slice that command handlers need to read. */
export interface CanvasReadState {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  canvasId: string;
}

/** The result produced by the executor after applying a command batch. */
export interface CanvasWriteResult {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  /** Whether the batch needs edge handle recalculation (unused until CONNECT_NODES lands). */
  requiresEdgeReroute: boolean;
  /** Whether the executor determined an undo/delta-log entry is needed. */
  snapshotNeeded: boolean;
}

/**
 * Accumulated side-effect manifest collected during a batch execution.
 * Pure data — the engine never invokes host APIs, it only describes what
 * happened; the host (apps/api) drains this after committing the write
 * result.
 */
export interface PendingEffects {
  /** Nodes created or mutated in this batch. */
  mutatedNodes: CanvasNode[];
  /** Node IDs deleted in this batch. */
  deletedNodeIds: string[];
}
