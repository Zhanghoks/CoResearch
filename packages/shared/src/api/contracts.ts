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
  nodes: unknown[];
  edges: unknown[];
}
