// Shared canvas command schema executed by both the API and agent flows.
// Source: Huabu-main/packages/shared/src/types/canvas/command.ts, trimmed
// per docs/spec/03-canvas-engine-port.md §2. Ticket 05 adds
// MERGE_NODE_DATA / SET_NODE_GEOMETRY / SET_NODE_PARENT. Remaining
// commands (CONNECT/DISCONNECT/SET_NODE_SELECTION/SET_FRAME_LAYOUT)
// land with the slice that first uses them.

import type { CanvasNodeType } from "./node.js";
import type { Point } from "./layout.js";

/** Bare uuid — see ADR 0015. */
export type CanvasNodeId = string;
export type CanvasEdgeId = string;

export interface NodeSize {
  width: number;
  height?: number;
}

type CanvasNodeCreateInputByType<T extends CanvasNodeType> = {
  /** Optional explicit id — omit to let `preAssignIds`/the engine assign one. */
  id?: CanvasNodeId;
  nodeType: T;
  data?: Record<string, unknown>;
  /**
   * Top-left position in **parent-local** coordinates (relative to
   * `parentId`, or absolute canvas coordinates when there is no
   * `parentId`). Always required — the engine has no auto-placement.
   */
  position: Point;
  size?: NodeSize;
  parentId?: CanvasNodeId | null;
  /**
   * UI-only creation hint controlling create-time selection (honoured
   * only for `source === 'ui'`; a no-op for agent/system creates).
   */
  selectOnCreate?: boolean;
};

export type CanvasNodeCreateInput = {
  [T in CanvasNodeType]: CanvasNodeCreateInputByType<T>;
}[CanvasNodeType];

export type CanvasNodeDataMergePatch = {
  nodeId: CanvasNodeId;
  patch: Record<string, unknown>;
};

export type CanvasNodeGeometryUpdate = {
  nodeId: CanvasNodeId;
  position?: Point;
  size?: NodeSize;
};

export type CanvasCommand =
  | { type: "CREATE_NODES"; nodes: CanvasNodeCreateInput[] }
  | { type: "DELETE_NODES"; nodeIds: CanvasNodeId[] }
  | { type: "MERGE_NODE_DATA"; patches: CanvasNodeDataMergePatch[] }
  | { type: "SET_NODE_GEOMETRY"; items: CanvasNodeGeometryUpdate[] }
  | {
      type: "SET_NODE_PARENT";
      nodeIds: CanvasNodeId[];
      parentId: CanvasNodeId | null;
    };

export type CanvasCommandType = CanvasCommand["type"];
