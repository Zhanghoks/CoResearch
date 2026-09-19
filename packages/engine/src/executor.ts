// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
//
// Ported from Huabu-main/packages/shared/src/canvas-engine/executor.ts.
// Ticket 02 keeps the batch-dispatch + end-of-batch `normalizeTreeOrder`
// funnel and the all-rejected-is-a-no-op version semantics. Structured
// frame relayout / fitFrames (ADR 0010) and note provenance are skipped
// until the tickets that add SET_FRAME_LAYOUT / MERGE_NODE_DATA.

import { HANDLERS, COMMAND_META } from "./commands/index.js";
import { normalizeTreeOrder, type NestableNode } from "./container/index.js";

import type {
  CanvasReadState,
  CanvasWriteResult,
  PendingEffects,
} from "./interfaces.js";
import type { CommandHandler } from "./commands/index.js";
import type {
  CanvasCommand,
  CanvasExecution,
  CanvasCommandResult,
} from "@coresearch/shared";

export interface ExecutorOptions {
  /** Reserved for agent batches once SET_FRAME_LAYOUT lands. */
  forceFitFrames?: boolean;
}

export interface ExecutorOutput {
  writeResult: CanvasWriteResult;
  commandResults: CanvasCommandResult[];
  pendingEffects: PendingEffects;
}

export function executeCanvasCommands(
  execution: CanvasExecution,
  state: CanvasReadState,
  _options: ExecutorOptions = {},
): ExecutorOutput {
  const source = execution.source ?? "ui";

  const commandResults: CanvasCommandResult[] = [];
  const pendingEffects: PendingEffects = {
    mutatedNodes: [],
    deletedNodeIds: [],
  };

  let currentNodes = state.nodes;
  let currentEdges = state.edges;
  let anyApplied = false;

  for (const cmd of execution.commands) {
    const handler = HANDLERS[
      cmd.type as keyof typeof HANDLERS
    ] as CommandHandler<CanvasCommand>;

    const result = handler(cmd, {
      nodes: currentNodes,
      edges: currentEdges,
      canvasId: state.canvasId,
      source,
    });

    commandResults.push({
      command: cmd,
      applied: result.applied,
      reason: result.reason,
    });

    if (result.applied) {
      anyApplied = true;
      currentNodes = result.nodes;
      currentEdges = result.edges;
      if (result.mutatedNodes) {
        pendingEffects.mutatedNodes.push(...result.mutatedNodes);
      }
      if (result.deletedNodeIds) {
        pendingEffects.deletedNodeIds.push(...result.deletedNodeIds);
      }
    }
  }

  // Authoritative tree-order invariant (single end-of-batch pass).
  // Parents must precede children; frame children carry zIndex -1.
  if (anyApplied) {
    currentNodes = normalizeTreeOrder(currentNodes as NestableNode[]);
  }

  const snapshotNeeded =
    anyApplied &&
    execution.commands.some((c) => COMMAND_META[c.type]?.snapshot === "yes");

  const requiresEdgeReroute = execution.commands.some(
    (c, i) =>
      commandResults[i]?.applied && COMMAND_META[c.type]?.requiresEdgeReroute,
  );

  return {
    writeResult: {
      nodes: anyApplied ? currentNodes : state.nodes,
      edges: anyApplied ? currentEdges : state.edges,
      requiresEdgeReroute,
      snapshotNeeded,
    },
    commandResults,
    pendingEffects,
  };
}
