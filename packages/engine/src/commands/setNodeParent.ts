// Adapted from Huabu-main/packages/shared/src/canvas-engine/commands/setNodeParent.ts.
// Whole-command validation (invalid-target / invalid-parent) is kept;
// coordinate conversion lives in container/mutation.ts.

import { noop, type CommandDefinition } from "./types.js";
import {
  canParentNode,
  getDescendantIds,
  moveNodeIntoContainer,
  moveNodeOutOfContainer,
  type NestableNode,
} from "../container/index.js";

import type { CanvasCommand } from "@coresearch/shared";

type Cmd = Extract<CanvasCommand, { type: "SET_NODE_PARENT" }>;

const setNodeParent: CommandDefinition<Cmd> = {
  meta: {
    snapshot: "yes",
    requiresEdgeReroute: true,
  },

  handler(cmd, state) {
    if (cmd.nodeIds.length === 0) return noop(state);

    let result = state.nodes as NestableNode[];
    const parentId = cmd.parentId;

    for (const nodeId of cmd.nodeIds) {
      if (!result.some((n) => n.id === nodeId)) {
        return noop(state, "invalid-target");
      }
    }
    if (parentId) {
      const parent = result.find((node) => node.id === parentId);
      if (!parent) return noop(state, "invalid-parent");
      for (const nodeId of cmd.nodeIds) {
        const child = result.find((node) => node.id === nodeId);
        if (!canParentNode(parent, child)) {
          return noop(state, "invalid-parent");
        }
        if (
          child &&
          child.parentId !== parentId &&
          getDescendantIds(result, child.id).includes(parentId)
        ) {
          return noop(state, "invalid-parent");
        }
      }
    }

    let changed = false;
    for (const nodeId of cmd.nodeIds) {
      const node = result.find((n) => n.id === nodeId);
      if (!node) continue;
      if (parentId) {
        if (node.parentId === parentId) continue;
        const next = moveNodeIntoContainer(result, nodeId, parentId);
        if (next === result) continue;
        result = next;
        changed = true;
      } else {
        if (!node.parentId) continue;
        const next = moveNodeOutOfContainer(result, nodeId);
        if (next === result) continue;
        result = next;
        changed = true;
      }
    }

    if (!changed) return noop(state);

    return {
      applied: true,
      nodes: result,
      edges: state.edges,
    };
  },
};

export default setNodeParent;
