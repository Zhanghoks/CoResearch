// Wire contracts shared by the CoResearch API and the web client.
//
// These live here rather than being declared once per side because they
// are the same contract: two copies drift silently (an earlier version
// had `nodes: never[]` on the API and `nodes: unknown[]` on the web, and
// nothing caught it). docs/spec/02-api-contract.md is the prose source
// of truth; this file is its type-level counterpart.

/** One row of `GET /api/projects`. */
export interface ProjectSummary {
  id: string;
  title: string;
  /**
   * The project's primary canvas — the one created alongside it
   * (ADR 0003). Null only if a project somehow has no canvas.
   */
  canvasId: string | null;
  createdAt: string;
}

/** Response of `POST /api/projects`. */
export interface CreatedProject {
  projectId: string;
  canvasId: string;
}

/**
 * Response of `GET /api/canvases/:canvasId`.
 *
 * No canvas `title`: a Canvas is a runtime/rendering boundary that does
 * not own research content (CONTEXT.md), and in V1 it carries only the
 * `'Main Canvas'` column default. The project's title is what the UI
 * shows, and it is carried here so a deep link to /canvas/:id can render
 * its header on a cold load.
 */
export interface CanvasSnapshot {
  canvasId: string;
  projectId: string;
  projectTitle: string;
  /** Monotonic canvas version, compared against delta versions. */
  version: number;
  /**
   * Empty until note editing (ticket 05) and candidate acceptance
   * (ticket 06) put nodes on the board. Typed `unknown[]` rather than
   * `never[]`: the wire shape is settled by the slice that first emits
   * one, and `never[]` would read as "can never hold anything".
   */
  nodes: WireCanvasNode[];
  edges: WireCanvasEdge[];
}

/** xyflow-compatible node as stored/returned by the API. */
export interface WireCanvasNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  parentId?: string | null;
  data: Record<string, unknown>;
  width?: number | null;
  height?: number | null;
  zIndex?: number | null;
}

export interface WireCanvasEdge {
  id: string;
  source: string;
  target: string;
  edgeType?: string;
}

/** Body of `POST /api/canvases/:canvasId/execute`. */
export interface ExecuteCanvasBody {
  commands: import("../canvas/command.js").CanvasCommand[];
}

/** Response of `POST /api/canvases/:canvasId/execute`. */
export interface ExecuteCanvasResult {
  version: number;
  fromVersion: number;
  commandResults: Array<{
    type: string;
    applied: boolean;
    reason?: string;
  }>;
  /** Coarse deltas of this batch; empty when the batch was a no-op. */
  deltas: unknown[];
}

/** One row from `GET /api/canvases/:canvasId/deltas?afterVersion=N`. */
export interface CanvasDeltaLogEntry {
  fromVersion: number;
  toVersion: number;
  deltas: unknown[];
}

export interface CanvasDeltaLog {
  entries: CanvasDeltaLogEntry[];
}

/** Wire shape of a Track A candidate (docs/spec/04 §3). */
export interface CandidatePart {
  type: "research_candidate";
  candidateId: string;
  schemaVersion: 1;
  kind: string;
  payload: unknown;
  provenance: {
    runId: string;
    messageId: string;
    derivedFrom?: string[];
    asOf?: string;
  };
  materialized?: { entityId: string; at: string };
}

export interface CandidateList {
  candidates: CandidatePart[];
}

/** Body of `POST /api/projects/:projectId/candidates/:candidateId/accept`. */
export interface AcceptCandidateBody {
  canvasId: string;
  placement: {
    parentNodeId?: string;
    position: { x: number; y: number };
  };
}

export interface AcceptCandidateResult {
  entityId: string;
  nodeId: string;
  alreadyMaterialized: boolean;
  version: number;
  fromVersion: number;
  deltas: unknown[];
}
