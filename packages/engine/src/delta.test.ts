import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyDeltas, invertDelta, type Delta } from "./delta.js";
import { diffCanvasState } from "./diff.js";
import type { CanvasEdge, CanvasNode } from "./interfaces.js";

function note(
  id: string,
  extra: Record<string, unknown> = {},
  data: Record<string, unknown> = {},
): CanvasNode {
  return {
    id,
    type: "note",
    position: { x: 0, y: 0 },
    data,
    ...extra,
  } as CanvasNode;
}

function edge(
  id: string,
  source: string,
  target: string,
  extra: Record<string, unknown> = {},
): CanvasEdge {
  return { id, source, target, ...extra } as CanvasEdge;
}

function ids(nodes: { id: string }[]): string[] {
  return nodes.map((n) => n.id).sort();
}

describe("delta round-trip", () => {
  it("invertDelta ∘ applyDeltas returns the original snapshot", () => {
    const prev = {
      nodes: [note("a", {}, { label: "A" }), note("b")],
      edges: [edge("e1", "a", "b")],
    };
    const next = {
      nodes: [note("b"), note("c", {}, { label: "C" })],
      edges: [edge("e2", "b", "c")],
    };
    const deltas = diffCanvasState(prev, next);
    const applied = applyDeltas(prev, deltas);
    assert.deepEqual(ids(applied.nodes), ids(next.nodes));
    assert.equal(applied.edges.length, next.edges.length);

    const undone = applyDeltas(applied, deltas.map(invertDelta));
    assert.deepEqual(ids(undone.nodes), ids(prev.nodes));
    assert.equal(undone.edges.length, prev.edges.length);
  });

  it("invertDelta is self-inverse on every delta kind", () => {
    const samples: Delta[] = [
      { type: "INSERT_NODE", node: note("n") },
      { type: "DELETE_NODE", node: note("n") },
      { type: "REPLACE_NODE", prev: note("n", {}, { label: "a" }), next: note("n", {}, { label: "b" }) },
      { type: "INSERT_EDGE", edge: edge("e", "a", "b") },
      { type: "DELETE_EDGE", edge: edge("e", "a", "b") },
      {
        type: "REPLACE_EDGE",
        prev: edge("e", "a", "b"),
        next: edge("e", "a", "c"),
      },
    ];
    for (const d of samples) {
      assert.deepEqual(invertDelta(invertDelta(d)), d);
    }
  });
});

describe("diffCanvasState — runtime UI fields", () => {
  it("emits no delta when only selected flips on a node", () => {
    const prev = { nodes: [note("a", { selected: true })], edges: [] };
    const next = { nodes: [note("a", { selected: false })], edges: [] };
    assert.deepEqual(diffCanvasState(prev, next), []);
  });

  it("still emits REPLACE when authored content changes", () => {
    const prev = {
      nodes: [note("a", { selected: true }, { label: "X" })],
      edges: [],
    };
    const next = {
      nodes: [note("a", { selected: false }, { label: "Y" })],
      edges: [],
    };
    const deltas = diffCanvasState(prev, next);
    assert.equal(deltas.length, 1);
    assert.equal(deltas[0].type, "REPLACE_NODE");
  });
});
