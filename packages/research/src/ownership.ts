// Research-owned vs canvas-owned fields (docs/spec/04-research-domain-service.md §1).
// Shape follows Huabu agentNodeOwnership.ts: project / preserve / replay.

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

export type ResearchOwnedKey = (typeof RESEARCH_OWNED_DATA_KEYS)[number];
export type ResearchEntityData = Record<string, unknown>;

const OWNED = new Set<string>(RESEARCH_OWNED_DATA_KEYS);

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

export function patchTouchesOwnedKeys(patch: Record<string, unknown>): boolean {
  return RESEARCH_OWNED_DATA_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(patch, key),
  );
}

export function projectResearchEditableData(
  data: unknown,
): Partial<ResearchEntityData> {
  if (!data || typeof data !== "object") return {};
  const editable = { ...(data as Record<string, unknown>) };
  for (const key of RESEARCH_OWNED_DATA_KEYS) delete editable[key];
  return editable;
}

export function preserveResearchOwnedData(
  incoming: Partial<ResearchEntityData>,
  current: ResearchEntityData,
): ResearchEntityData {
  const result = { ...incoming };
  for (const key of RESEARCH_OWNED_DATA_KEYS) {
    if (Object.prototype.hasOwnProperty.call(current, key)) {
      result[key] = current[key];
    } else {
      delete result[key];
    }
  }
  return result;
}

export function replayResearchEditableData(
  current: ResearchEntityData,
  before: ResearchEntityData,
  after: ResearchEntityData,
): Partial<ResearchEntityData> {
  const result = { ...current };
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (OWNED.has(key)) continue;
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue;
    if (Object.prototype.hasOwnProperty.call(after, key)) {
      result[key] = after[key];
    } else {
      delete result[key];
    }
  }
  return result;
}
