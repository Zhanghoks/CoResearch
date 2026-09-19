// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
//
// Ported from Huabu-main/packages/shared/src/canvas-engine/commands/types.ts.
// `CommandHandlerResult` is trimmed to the fields ticket 02's two handlers
// populate (`affectedFrameIds`/`contentEditedNodeIds`/`deferredFitFrameIds`
// come back with the frame-fit and MERGE_NODE_DATA tickets).

import type {
  CanvasCommand,
  CanvasCommandFailureReason,
  CanvasExecutionSource,
} from "@coresearch/shared";
import type { CanvasReadState } from "../interfaces.js";
import type { Node, Edge } from "@xyflow/react";

export interface CommandMeta {
  snapshot: "yes" | "caller" | "no";
  requiresEdgeReroute: boolean;
}

export interface CommandHandlerResult {
  applied: boolean;
  reason?: CanvasCommandFailureReason;
  nodes: Node[];
  edges: Edge[];
  /** Nodes created or mutated by this command. */
  mutatedNodes?: Node[];
  /** Node IDs that were deleted. */
  deletedNodeIds?: string[];
}

export interface CommandHandlerContext extends CanvasReadState {
  source: CanvasExecutionSource;
}

export type CommandHandler<T extends CanvasCommand = CanvasCommand> = (
  cmd: T,
  state: CommandHandlerContext,
) => CommandHandlerResult;

export interface CommandDefinition<T extends CanvasCommand = CanvasCommand> {
  meta: CommandMeta;
  handler: CommandHandler<T>;
}

/** Build a no-op (not-applied) result from the current state. */
export function noop(
  state: CanvasReadState,
  reason: CanvasCommandFailureReason = "no-op",
): CommandHandlerResult {
  return { applied: false, reason, nodes: state.nodes, edges: state.edges };
}
