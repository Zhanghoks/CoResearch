// Client catch-up policy (ADR 0002).
// Realtime INSERT on canvas_deltas is a fast path, not the authority.
// Compare localVersion against the event's fromVersion to decide.

export type CanvasSyncAction = "apply" | "catch-up" | "ignore";

export function nextSyncAction(
  localVersion: number,
  eventFromVersion: number,
  eventToVersion: number,
): CanvasSyncAction {
  if (eventToVersion <= localVersion) return "ignore";
  if (eventFromVersion === localVersion) return "apply";
  return "catch-up";
}
