import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { executeCanvasCommands } from "./executor.js";
import type { CanvasEdge, CanvasNode } from "./interfaces.js";
import type { CanvasCommand, CanvasNodeId } from "@coresearch/shared";

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

function run(commands: CanvasCommand[], startNodes: CanvasNode[]) {
  return executeCanvasCommands(
    { source: "ui", commands },
    { nodes: startNodes, edges: [] as CanvasEdge[], canvasId: "c1" },
  );
}

function indexOfId(nodes: CanvasNode[], id: string): number {
  return nodes.findIndex((n) => n.id === id);
}

describe("executeCanvasCommands: tree-order invariant", () => {
  it("orders a frame ahead of a child created in the same batch", () => {
    // Child is listed BEFORE the frame in the create payload; the
    // executor must still emit the frame first so the child can nest.
    const { writeResult } = run(
      [
        {
          type: "CREATE_NODES",
          nodes: [
            {
              id: "node-c" as CanvasNodeId,
              nodeType: "note",
              position: { x: 10, y: 10 },
              parentId: "node-f" as CanvasNodeId,
            },
            {
              id: "node-f" as CanvasNodeId,
              nodeType: "frame",
              position: { x: 0, y: 0 },
            },
          ],
        },
      ],
      [],
    );

    assert.ok(indexOfId(writeResult.nodes, "node-f") >= 0);
    assert.ok(indexOfId(writeResult.nodes, "node-c") >= 0);
    assert.ok(
      indexOfId(writeResult.nodes, "node-f") <
        indexOfId(writeResult.nodes, "node-c"),
    );
    assert.equal(writeResult.nodes.find((n) => n.id === "node-c")?.zIndex, -1);
  });
});

describe("executeCanvasCommands: all-rejected batch is a no-op", () => {
  it("returns the original node/edge references when every command is rejected", () => {
    const start = [node("node-a")];
    const startEdges: CanvasEdge[] = [];
    const { writeResult, commandResults } = executeCanvasCommands(
      {
        source: "agent",
        commands: [
          { type: "CREATE_NODES", nodes: [] },
          {
            type: "DELETE_NODES",
            nodeIds: ["node-ghost" as CanvasNodeId],
          },
        ],
      },
      { nodes: start, edges: startEdges, canvasId: "c1" },
    );

    assert.equal(commandResults.every((r) => r.applied === false), true);
    assert.equal(writeResult.nodes, start);
    assert.equal(writeResult.edges, startEdges);
    assert.equal(writeResult.snapshotNeeded, false);
  });

  it("rejects CREATE_NODES with a duplicate id as a no-op", () => {
    const start = [node("node-a")];
    const { writeResult, commandResults } = run(
      [
        {
          type: "CREATE_NODES",
          nodes: [
            {
              id: "node-a" as CanvasNodeId,
              nodeType: "note",
              position: { x: 0, y: 0 },
            },
          ],
        },
      ],
      start,
    );
    assert.equal(commandResults[0]?.applied, false);
    assert.equal(commandResults[0]?.reason, "duplicate-id");
    assert.equal(writeResult.nodes, start);
  });
});
