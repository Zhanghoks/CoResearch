// Canvas execution/batch types.
// Source: Huabu-main/packages/shared/src/types/canvas/execution.ts — ported
// as-is per docs/spec/03-canvas-engine-port.md §2 (source: 'ui'|'agent'|
// 'system', the 8-value failure reason enum, ExecuteConflict).

import type { CanvasCommand } from "./command.js";

export type CanvasExecutionSource = "ui" | "agent" | "system";

/** One logical batch of commands that should validate and commit together. */
export interface CanvasExecution {
  /** Defaults to `'ui'` when omitted. */
  source?: CanvasExecutionSource;
  commands: CanvasCommand[];
}

export type CanvasCommandFailureReason =
  | "no-op"
  | "not-found"
  | "invalid-parent"
  | "invalid-target"
  | "invalid-scope"
  | "cycle"
  | "duplicate-id"
  | "conflict";

export interface CanvasCommandResult {
  command: CanvasCommand;
  applied: boolean;
  reason?: CanvasCommandFailureReason;
}

export interface ExecuteConflict {
  nodeId: string;
  reason: "not-read" | "stale";
  expectedRev?: string;
  currentRev: string;
  currentContent?: string;
}

/** Per-command outcome returned by `executeCanvasCommands`. */
export interface CanvasCommandResult {
  command: CanvasCommand;
  applied: boolean;
  reason?: CanvasCommandFailureReason;
}
