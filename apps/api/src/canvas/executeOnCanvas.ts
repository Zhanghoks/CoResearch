// Server-side canvas command host (docs/spec/03 §4 executor-host).
//
// Inside one withRequestContext transaction:
//   lock → load → preAssignIds → execute → persist deltas → bump version.
// A fully rejected batch is a no-op and does not bump version.

import {
  diffCanvasState,
  executeCanvasCommands,
  preAssignIds,
} from "@coresearch/engine";
import type {
  CanvasCommand,
  ExecuteCanvasResult,
} from "@coresearch/shared";

import type { RequestDb } from "../db/index.js";
import { withCanvasMutex } from "./advisoryLock.js";
import { loadCanvasGraph, persistDeltas } from "./state.js";

export async function executeOnCanvas(
  db: RequestDb,
  canvasId: string,
  commands: CanvasCommand[],
): Promise<ExecuteCanvasResult | null> {
  return withCanvasMutex(db, canvasId, async () => {
    const graph = await loadCanvasGraph(db, canvasId);
    if (!graph) return null;

    const assigned = preAssignIds(commands, "ui");
    const output = executeCanvasCommands(
      { source: "ui", commands: assigned },
      {
        nodes: graph.nodes,
        edges: graph.edges,
        canvasId,
      },
    );

    const anyApplied = output.commandResults.some((r) => r.applied);
    if (!anyApplied) {
      return {
        version: graph.version,
        fromVersion: graph.version,
        commandResults: output.commandResults.map((r) => ({
          type: r.command.type,
          applied: r.applied,
          reason: r.reason,
        })),
        deltas: [],
      };
    }

    const deltas = diffCanvasState(
      { nodes: graph.nodes, edges: graph.edges },
      {
        nodes: output.writeResult.nodes,
        edges: output.writeResult.edges,
      },
    );
    const toVersion = graph.version + 1;
    await persistDeltas(db, canvasId, graph.version, toVersion, deltas);

    return {
      version: toVersion,
      fromVersion: graph.version,
      commandResults: output.commandResults.map((r) => ({
        type: r.command.type,
        applied: r.applied,
        reason: r.reason,
      })),
      deltas,
    };
  });
}
