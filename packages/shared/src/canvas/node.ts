// Canvas node types.
// Source: Huabu-main/packages/shared/src/types/canvas/node.ts, trimmed per
// docs/spec/03-canvas-engine-port.md §2: sketch/office/video/audio/image/
// spacePreview dropped; CoResearch keeps six `node_type`s (ADR 0008) —
// `crEntity` is new (Research Entity projection), the other five are
// Huabu's `frame`/`note`/`question`/`pdf`/`web` carried over unchanged in
// shape.
//
// Per-type field lists (Research-owned keys on `crEntity`, frame layout
// fields) are NOT decided yet in code — they land with the tickets that
// actually need them (04/07 for ownership, the SET_FRAME_LAYOUT ticket for
// `frameColumn`/`frameRow`/`FRAME_LAYOUT_MODES`). Until then each type's
// `data` bag is intentionally loose (`Record<string, unknown>` plus the one
// field — `label` — every node needs regardless of type).

export const CANVAS_NODE_TYPES = [
  "crEntity",
  "frame",
  "note",
  "question",
  "pdf",
  "web",
] as const;

export type CanvasNodeType = (typeof CANVAS_NODE_TYPES)[number];

export interface NodeDataBase {
  label?: string;
  [key: string]: unknown;
}

export type NodeData = NodeDataBase & { type: CanvasNodeType };

export function isCanvasNodeType(value: unknown): value is CanvasNodeType {
  return (
    typeof value === "string" &&
    (CANVAS_NODE_TYPES as readonly string[]).includes(value)
  );
}
