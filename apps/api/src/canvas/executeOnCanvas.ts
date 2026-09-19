// Server-side canvas command host (docs/spec/03 §4 executor-host).
//
// Inside one withRequestContext transaction:
//   lock → load → preAssignIds → execute → persist deltas → bump version.
// A fully rejected batch is a no-op and does not bump version.
//
// MERGE_NODE_DATA on a crEntity goes through executeFromRequest
// (ticket 07). Owned keys are invalid-scope regardless of a forged
// source:'system' on the command.

import {
  canonicalizeDeltas,
  diffCanvasState,
  executeCanvasCommands,
  preAssignIds,
} from "@coresearch/engine";
import { executeFromRequest, patchTouchesOwnedKeys } from "@coresearch/research";
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
    const crEntityIds = new Set(
      graph.nodes.filter((n) => n.type === "crEntity").map((n) => n.id),
    );

    const allowed: CanvasCommand[] = [];
    const gated: ExecuteCanvasResult["commandResults"] = [];

    for (const cmd of assigned) {
      if (cmd.type !== "MERGE_NODE_DATA") {
        allowed.push(cmd);
        continue;
      }
      const crPatches = cmd.patches.filter((p) => crEntityIds.has(p.nodeId));
      let blocked = false;
      for (const patch of crPatches) {
        const gate = await executeFromRequest(
          { applyMerge: async () => ({ applied: true }) },
          patch,
        );
        if (!gate.applied) {
          gated.push({
            type: cmd.type,
            applied: false,
            reason: gate.reason ?? "invalid-scope",
          });
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      // Belt: even if the gate shape changes, owned keys never reach the engine.
      if (crPatches.some((p) => patchTouchesOwnedKeys(p.patch))) {
        gated.push({
          type: cmd.type,
          applied: false,
          reason: "invalid-scope",
        });
        continue;
      }
      allowed.push(cmd);
    }

    if (allowed.length === 0) {
      return {
        version: graph.version,
        fromVersion: graph.version,
        commandResults: gated,
        deltas: [],
      };
    }

    const output = executeCanvasCommands(
      { source: "ui", commands: allowed },
      {
        nodes: graph.nodes,
        edges: graph.edges,
        canvasId,
      },
    );

    const commandResults = [
      ...gated,
      ...output.commandResults.map((r) => ({
        type: r.command.type,
        applied: r.applied,
        reason: r.reason,
      })),
    ];

    const anyApplied = commandResults.some((r) => r.applied);
    if (!anyApplied) {
      return {
        version: graph.version,
        fromVersion: graph.version,
        commandResults,
        deltas: [],
      };
    }

    const deltas = canonicalizeDeltas(
      diffCanvasState(
        { nodes: graph.nodes, edges: graph.edges },
        {
          nodes: output.writeResult.nodes,
          edges: output.writeResult.edges,
        },
      ),
    );
    if (deltas.length === 0) {
      return {
        version: graph.version,
        fromVersion: graph.version,
        commandResults,
        deltas: [],
      };
    }
    const toVersion = graph.version + 1;
    await persistDeltas(db, canvasId, graph.version, toVersion, deltas);

    return {
      version: toVersion,
      fromVersion: graph.version,
      commandResults,
      deltas,
    };
  });
}
