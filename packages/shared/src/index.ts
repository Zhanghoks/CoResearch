export * from "./canvas/execution.js";

// The remaining canvas types (command.ts, node.ts, edge.ts, color.ts,
// layout.ts) are a direct port from Huabu-main/packages/shared/src/types/canvas/,
// trimmed per docs/spec/03-canvas-engine-port.md §2. Copy those files in
// rather than reconstructing them from memory — they're non-trivial and
// must match Huabu's actual discriminated unions exactly for the ported
// engine (packages/engine) to type-check against them.
