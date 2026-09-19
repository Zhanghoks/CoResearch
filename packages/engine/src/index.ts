// Canvas command engine — ported from Huabu-main/packages/shared/src/canvas-engine/.
// Not implemented yet. Port in this order (docs/spec/03-canvas-engine-port.md §5,
// step 1 — pure Node, no UI, tests first):
//
//   1. executeCanvasCommands + CREATE_NODES / DELETE_NODES + delta + invertDelta.
//      Copy executor.ts / interfaces.ts / delta.ts / diff.ts from Huabu-main as-is
//      (docs/spec/03-canvas-engine-port.md §1), then commands/createNodes.ts,
//      commands/deleteNodes.ts, commands/types.ts, commands/index.ts.
//      Test against Huabu's own canvas-engine/__tests__/ coverage: delta
//      round-trips, tree-order invariants, all-rejected batch is a no-op.
//   2. The remaining 7 commands (mergeNodeData, setNodeGeometry, setNodeParent,
//      connectNodes, disconnectEdges, setNodeSelection, setFrameLayout — the
//      last one restored by ADR 0010, plus autoLayout/gridLayout.ts).
//
// packages/research/src/ownership.ts (not this package) owns the
// RESEARCH_OWNED_DATA_KEYS guard — see docs/spec/04-research-domain-service.md.

export {};
