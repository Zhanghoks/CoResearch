// Canvas geometry primitives.
// Source: Huabu-main/packages/shared/src/types/canvas/layout.ts — ported
// verbatim (docs/spec/03-canvas-engine-port.md §2: "大概率保留... 未逐文件核实").
// Only `Point` is needed for ticket 02 (CREATE_NODES position); the rest of
// Huabu's layout.ts (Bounds, frame sizing geometry) lands with the tickets
// that actually use it (SET_NODE_GEOMETRY / SET_FRAME_LAYOUT).

export interface Point {
  x: number;
  y: number;
}
