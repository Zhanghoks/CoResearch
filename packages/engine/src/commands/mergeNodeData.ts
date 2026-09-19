// Adapted from Huabu-main/packages/shared/src/canvas-engine/commands/mergeNodeData.ts.
// Ticket 05 only needs note content/label patches: shallow-merge `data`,
// deep-merge `data.style`. Question/agent ownership gates wait for ticket 07.

import { noop, type CommandDefinition } from "./types.js";

import type { CanvasCommand } from "@coresearch/shared";
import type { Node } from "@xyflow/react";

type Cmd = Extract<CanvasCommand, { type: "MERGE_NODE_DATA" }>;

const mergeNodeData: CommandDefinition<Cmd> = {
  meta: {
    snapshot: "yes",
    requiresEdgeReroute: false,
  },

  handler(cmd, state) {
    if (cmd.patches.length === 0) return noop(state);

    const patchMap = new Map(
      cmd.patches.map((p) => [p.nodeId, p.patch] as const),
    );
    const mutatedNodes: Node[] = [];
    let anyApplied = false;

    const nextNodes = state.nodes.map((n) => {
      const patch = patchMap.get(n.id);
      if (!patch) return n;
      anyApplied = true;
      const dataRec = (n.data ?? {}) as Record<string, unknown>;
      const mergedData: Record<string, unknown> = { ...dataRec, ...patch };
      if ("style" in patch) {
        const incomingStyle = patch.style;
        if (incomingStyle && typeof incomingStyle === "object") {
          const existingStyle =
            dataRec.style && typeof dataRec.style === "object"
              ? (dataRec.style as Record<string, unknown>)
              : {};
          mergedData.style = {
            ...existingStyle,
            ...(incomingStyle as Record<string, unknown>),
          };
        }
      }
      const updated: Node = { ...n, data: mergedData };
      mutatedNodes.push(updated);
      return updated;
    });

    if (!anyApplied) return noop(state, "not-found");

    return {
      applied: true,
      nodes: nextNodes,
      edges: state.edges,
      mutatedNodes,
    };
  },
};

export default mergeNodeData;
