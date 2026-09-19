// Shared canvas command schema executed by both the API and agent flows.
// Source: Huabu-main/packages/shared/src/types/canvas/command.ts, trimmed
// per docs/spec/03-canvas-engine-port.md §2 to the commands ticket
// 02-canvas-engine-core.md actually implements (CREATE_NODES/DELETE_NODES).
// The other 7 commands (MERGE_NODE_DATA/SET_NODE_PARENT/CONNECT_NODES/
// DISCONNECT_EDGES/SET_NODE_SELECTION/SET_FRAME_LAYOUT/SET_NODE_GEOMETRY)
// get added to this union — together with their handlers — by whichever
// later vertical slice needs them first; do not pre-declare the union
// wider than what's implemented (an unimplemented union member would make
// `HANDLERS` fail its exhaustiveness check for nothing).

import type { CanvasNodeType, NodeData } from "./node.js";
import type { Point } from "./layout.js";
import type { PrefixedId } from "../utils/id.js";

export type CanvasNodeId = PrefixedId<"node">;
export type CanvasEdgeId = PrefixedId<"edge">;

export interface NodeSize {
  width: number;
  height?: number;
}

type CanvasNodeCreateInputByType<T extends CanvasNodeType> = {
  /** Optional explicit id — omit to let `preAssignIds`/the engine assign one. */
  id?: CanvasNodeId;
  nodeType: T;
  data?: Partial<Omit<Extract<NodeData, { type: T }>, "type">>;
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

export type CanvasCommand =
  | { type: "CREATE_NODES"; nodes: CanvasNodeCreateInput[] }
  | { type: "DELETE_NODES"; nodeIds: CanvasNodeId[] };

export type CanvasCommandType = CanvasCommand["type"];
