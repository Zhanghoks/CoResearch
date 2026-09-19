// Research-owned vs canvas-owned fields (docs/spec/04-research-domain-service.md §1).
// Ticket 06 only needs the key lists and the native_data whitelist so
// accept/persist never write entity semantics into canvas_nodes.
// The three projection helpers land with ticket 07.

export const RESEARCH_OWNED_DATA_KEYS = [
  "entityKind",
  "currentRevision",
  "contentHash",
  "status",
  "origin",
  "confirmed",
  "stale",
  "summary",
  "payload",
] as const;

export const USER_OWNED_DATA_KEYS = ["userNote", "pinned", "collapsed"] as const;

/** crEntity native_data: canvas annotations only (ADR 0008). */
export function nativeDataForCrEntity(
  data: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!data) return out;
  for (const key of USER_OWNED_DATA_KEYS) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      out[key] = data[key];
    }
  }
  return out;
}
