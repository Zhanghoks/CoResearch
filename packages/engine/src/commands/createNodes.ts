// Adapted from Huabu-main/packages/shared/src/canvas-engine/commands/createNodes.ts.
//
// Deliberately narrower than Huabu's original: label auto-generation/
// deduplication (`utils/labels.ts`), per-type accent styling and default
// sizing (`utils/nodeSizes.ts`), auto-height materialization
// (`height/materialize.ts`/`height/policy.ts`), create-time selection
// nuance (`utils/selection.ts`), and the `question`-type ownership
// projection (`agentNodeOwnership.ts`) are Huabu features that ticket 02
// ("CREATE_NODES/DELETE_NODES 两条命令" only) has no use for yet — each
// comes back with the vertical slice that actually exercises it (labels/
// styling with the web-integration ticket, ownership with ticket 07). What
// ticket 02 needs from CREATE_NODES — id assignment, parenting, tree-order
// safety, delta-friendly output — is ported as-is.

import { noop, type CommandDefinition } from "./types.js";
import { createId, type CanvasCommand } from "@coresearch/shared";

import type { Node } from "@xyflow/react";

type Cmd = Extract<CanvasCommand, { type: "CREATE_NODES" }>;

const createNodes: CommandDefinition<Cmd> = {
  meta: {
    snapshot: "yes",
    requiresEdgeReroute: true,
  },

  handler(cmd, state) {
    if (cmd.nodes.length === 0) return noop(state);

    const existingIds = new Set(state.nodes.map((n) => n.id));
    const batchIds = new Set<string>();
    for (const input of cmd.nodes) {
      if (!input.id) continue;
      if (existingIds.has(input.id) || batchIds.has(input.id)) {
        return noop(state, "duplicate-id");
      }
      batchIds.add(input.id);
    }

    const newNodes: Node[] = [];

    for (const input of cmd.nodes) {
      const nodeId = input.id ?? createId("node");
      const data = (input.data ?? {}) as Record<string, unknown>;

      const node: Node = {
        id: nodeId,
        type: input.nodeType,
        position: input.position,
        data: { ...data, type: input.nodeType },
        ...(input.size ? { style: { ...input.size } } : {}),
      };

      if (input.parentId) {
        node.parentId = input.parentId;
      }

      newNodes.push(node);
    }

    // Tree order (parents before children, frame-child zIndex) is repaired
    // by the executor's single end-of-batch `normalizeTreeOrder` pass, so
    // this handler doesn't normalize itself.
    const orderedNodes = [...state.nodes, ...newNodes];

    // Create-time selection: honoured only for `source === 'ui'`, matching
    // Huabu's default (agent/system creates never auto-select). Per-node
    // `selectOnCreate` opt-out/opt-in nuance is deferred along with the
    // rest of the selection module.
    const finalNodes =
      state.source === "ui"
        ? orderedNodes.map((n) =>
            newNodes.some((created) => created.id === n.id)
              ? { ...n, selected: true }
              : n.selected
                ? { ...n, selected: false }
                : n,
          )
        : orderedNodes;

    return {
      applied: true,
      nodes: finalNodes,
      edges: state.edges,
      mutatedNodes: newNodes,
    };
  },
};

export default createNodes;
