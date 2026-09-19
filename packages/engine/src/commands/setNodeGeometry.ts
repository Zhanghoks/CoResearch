// Adapted from Huabu-main/packages/shared/src/canvas-engine/commands/setNodeGeometry.ts.
// Ticket 05 only needs position + optional size for notes. Height policy /
// materializeAutoHeight / structured-frame refit wait for SET_FRAME_LAYOUT.

import { noop, type CommandDefinition } from "./types.js";

import type { CanvasCommand } from "@coresearch/shared";

type Cmd = Extract<CanvasCommand, { type: "SET_NODE_GEOMETRY" }>;

const setNodeGeometry: CommandDefinition<Cmd> = {
  meta: {
    snapshot: "yes",
    requiresEdgeReroute: true,
  },

  handler(cmd, state) {
    if (cmd.items.length === 0) return noop(state);

    const updateMap = new Map(cmd.items.map((item) => [item.nodeId, item]));
    let changed = false;

    const nextNodes = state.nodes.map((n) => {
      const update = updateMap.get(n.id);
      if (!update) return n;
      changed = true;
      let updated = n;
      if (update.position) {
        updated = { ...updated, position: update.position };
      }
      if (update.size) {
        updated = {
          ...updated,
          style: {
            ...updated.style,
            width: update.size.width,
            ...(typeof update.size.height === "number"
              ? { height: update.size.height }
              : {}),
          },
        };
      }
      return updated;
    });

    if (!changed) return noop(state, "not-found");

    return {
      applied: true,
      nodes: nextNodes,
      edges: state.edges,
    };
  },
};

export default setNodeGeometry;
