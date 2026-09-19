// Server-side id assignment for CREATE_NODES.
//
// Huabu's host-layer `preAssignIds` (apps/server/.../canvas-executor.ts)
// fills in missing ids so the engine and the delta-log share them. Ticket
// 02 adds one CoResearch-specific rule on top: agent-sourced batches must
// not bring their own ids (canvas node ids are server-assigned —
// docs/spec/01-database-schema.md §3). UI/system batches may pass an id
// when a later command in the same batch needs to refer to the new node.

import { createId } from "@coresearch/shared";

import type {
  CanvasCommand,
  CanvasExecutionSource,
  CanvasNodeId,
} from "@coresearch/shared";

export function preAssignIds(
  commands: readonly CanvasCommand[],
  source: CanvasExecutionSource = "ui",
): CanvasCommand[] {
  const out: CanvasCommand[] = [];
  for (const cmd of commands) {
    if (cmd.type !== "CREATE_NODES") {
      out.push(cmd);
      continue;
    }
    const nodes = cmd.nodes.map((n) => {
      if (source === "agent") {
        return { ...n, id: createId("node") as CanvasNodeId };
      }
      if (n.id) return n;
      return { ...n, id: createId("node") as CanvasNodeId };
    });
    out.push({ ...cmd, nodes });
  }
  return out;
}
