// Canvas execution/batch types.
// Source: docs/spec/03-canvas-engine-port.md §2 — ported from Huabu's
// types/canvas/execution.ts as-is (source: 'ui'|'agent'|'system', the 8-value
// failure reason enum, ExecuteConflict). Fill in from the Huabu-main source
// at packages/shared/src/types/canvas/execution.ts.

export type CanvasCommandSource = "ui" | "agent" | "system";

export type CanvasCommandFailureReason =
  | "no-op"
  | "not-found"
  | "invalid-parent"
  | "invalid-target"
  | "invalid-scope"
  | "cycle"
  | "duplicate-id"
  | "conflict";

export interface ExecuteConflict {
  nodeId: string;
  reason: "not-read" | "stale";
  expectedRev?: string;
  currentRev: string;
  currentContent?: string;
}
