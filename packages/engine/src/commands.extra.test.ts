import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { executeCanvasCommands } from "./executor.js";
import type { CanvasNode } from "./interfaces.js";
import type { CanvasCommand } from "@coresearch/shared";

function node(
  id: string,
  type = "note",
  overrides: Partial<CanvasNode> = {},
): CanvasNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { type, label: id },
    ...overrides,
  } as CanvasNode;
}

function run(commands: CanvasCommand[], start: CanvasNode[]) {
  return executeCanvasCommands(
    { source: "ui", commands },
    { nodes: start, edges: [], canvasId: "c1" },
  );
}

describe("MERGE_NODE_DATA", () => {
  it("shallow-merges data and deep-merges style", () => {
    const start = [
      node("a", "note", {
        data: { type: "note", content: "old", style: { accent: "white" } },
      }),
    ];
    const { writeResult, commandResults } = run(
      [
        {
          type: "MERGE_NODE_DATA",
          patches: [
            {
              nodeId: "a",
              patch: { content: "new", style: { fontSize: 18 } },
            },
          ],
        },
      ],
      start,
    );
    assert.equal(commandResults[0]?.applied, true);
    const data = writeResult.nodes[0]?.data as Record<string, unknown>;
    assert.equal(data.content, "new");
    assert.deepEqual(data.style, { accent: "white", fontSize: 18 });
  });

  it("rejects a missing target as not-found", () => {
    const { commandResults, writeResult } = run(
      [{ type: "MERGE_NODE_DATA", patches: [{ nodeId: "ghost", patch: { content: "x" } }] }],
      [node("a")],
    );
    assert.equal(commandResults[0]?.applied, false);
    assert.equal(commandResults[0]?.reason, "not-found");
    assert.equal(writeResult.nodes[0]?.id, "a");
  });
});

describe("SET_NODE_GEOMETRY", () => {
  it("moves a node", () => {
    const { writeResult, commandResults } = run(
      [
        {
          type: "SET_NODE_GEOMETRY",
          items: [{ nodeId: "a", position: { x: 40, y: 80 } }],
        },
      ],
      [node("a")],
    );
    assert.equal(commandResults[0]?.applied, true);
    assert.deepEqual(writeResult.nodes[0]?.position, { x: 40, y: 80 });
  });
});

describe("SET_NODE_PARENT", () => {
  it("nests a note under a frame and repairs tree order", () => {
    const start = [node("child"), node("frame", "frame")];
    const { writeResult, commandResults } = run(
      [{ type: "SET_NODE_PARENT", nodeIds: ["child"], parentId: "frame" }],
      start,
    );
    assert.equal(commandResults[0]?.applied, true);
    const child = writeResult.nodes.find((n) => n.id === "child");
    const frameIdx = writeResult.nodes.findIndex((n) => n.id === "frame");
    const childIdx = writeResult.nodes.findIndex((n) => n.id === "child");
    assert.equal(child?.parentId, "frame");
    assert.ok(frameIdx < childIdx);
    assert.equal(child?.zIndex, -1);
  });

  it("rejects a missing parent as invalid-parent", () => {
    const { commandResults } = run(
      [{ type: "SET_NODE_PARENT", nodeIds: ["child"], parentId: "ghost" }],
      [node("child")],
    );
    assert.equal(commandResults[0]?.applied, false);
    assert.equal(commandResults[0]?.reason, "invalid-parent");
  });
});
