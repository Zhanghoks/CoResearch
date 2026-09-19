import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { preAssignIds } from "./preAssignIds.js";
import type { CanvasNodeId } from "@coresearch/shared";

describe("preAssignIds", () => {
  it("does not accept an agent-supplied node id", () => {
    const supplied = "node-agent-invented" as CanvasNodeId;
    const [cmd] = preAssignIds(
      [
        {
          type: "CREATE_NODES",
          nodes: [
            {
              id: supplied,
              nodeType: "note",
              position: { x: 0, y: 0 },
            },
          ],
        },
      ],
      "agent",
    );
    assert.equal(cmd.type, "CREATE_NODES");
    if (cmd.type !== "CREATE_NODES") return;
    assert.equal(cmd.nodes[0]?.id === supplied, false);
    assert.match(
      cmd.nodes[0]?.id ?? "",
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("fills in missing ids for ui batches and keeps caller ids", () => {
    const kept = "node-keep" as CanvasNodeId;
    const [cmd] = preAssignIds(
      [
        {
          type: "CREATE_NODES",
          nodes: [
            { id: kept, nodeType: "note", position: { x: 0, y: 0 } },
            { nodeType: "note", position: { x: 1, y: 1 } },
          ],
        },
      ],
      "ui",
    );
    assert.equal(cmd.type, "CREATE_NODES");
    if (cmd.type !== "CREATE_NODES") return;
    assert.equal(cmd.nodes[0]?.id, kept);
    assert.match(
      cmd.nodes[1]?.id ?? "",
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});
