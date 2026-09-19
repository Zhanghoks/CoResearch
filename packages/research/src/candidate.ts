// Track A candidate identity and the fixture/accept read shape.
// Accept's transaction lives in apps/api (it has to reuse the canvas
// persist host). This module is the shared parse/hash/presentation
// contract so the HTTP path and the Agent tool (ticket 08) cannot drift.

import { createHash } from "node:crypto";

export const RESEARCH_ENTITY_KINDS = [
  "seed",
  "direction",
  "phase",
  "focus",
  "problem",
  "claim",
  "hypothesis",
  "prediction",
  "work",
  "question",
  "probe",
  "requirement",
  "approach",
  "operation",
  "component",
  "method",
  "evaluation",
] as const;

export type ResearchEntityKind = (typeof RESEARCH_ENTITY_KINDS)[number];

export interface CandidatePart {
  type: "research_candidate";
  candidateId: string;
  schemaVersion: 1;
  kind: ResearchEntityKind;
  payload: unknown;
  provenance: {
    runId: string;
    messageId: string;
    derivedFrom?: string[];
    asOf?: string;
  };
  materialized?: { entityId: string; at: string };
}

export function isResearchEntityKind(value: unknown): value is ResearchEntityKind {
  return (
    typeof value === "string" &&
    (RESEARCH_ENTITY_KINDS as readonly string[]).includes(value)
  );
}

export function contentHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload ?? {})).digest("hex");
}

export function titleFromPayload(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const rec = payload as Record<string, unknown>;
    if (typeof rec.title === "string" && rec.title.trim()) return rec.title;
    if (typeof rec.summary === "string" && rec.summary.trim()) return rec.summary;
  }
  return fallback;
}

export function summaryFromPayload(payload: unknown): string | null {
  if (payload && typeof payload === "object") {
    const rec = payload as Record<string, unknown>;
    if (typeof rec.summary === "string") return rec.summary;
  }
  return null;
}

/**
 * Reconstruct a CandidatePart from an `agent_messages` row.
 * `candidateId` is the row id (docs/spec/01-database-schema.md).
 */
export function parseCandidatePart(
  messageId: string,
  payload: unknown,
): CandidatePart | null {
  if (!payload || typeof payload !== "object") return null;
  const entry = payload as Record<string, unknown>;
  const message = entry.message;
  if (!message || typeof message !== "object") return null;
  const msg = message as Record<string, unknown>;
  if (msg.role !== "custom" || msg.customType !== "research_candidate") {
    return null;
  }
  const details =
    msg.details && typeof msg.details === "object"
      ? (msg.details as Record<string, unknown>)
      : {};
  if (!isResearchEntityKind(details.kind)) return null;
  const provenanceIn =
    details.provenance && typeof details.provenance === "object"
      ? (details.provenance as Record<string, unknown>)
      : {};
  return {
    type: "research_candidate",
    candidateId: messageId,
    schemaVersion: 1,
    kind: details.kind,
    payload: details.payload ?? {},
    provenance: {
      runId: typeof provenanceIn.runId === "string" ? provenanceIn.runId : "fixture",
      messageId:
        typeof provenanceIn.messageId === "string" ? provenanceIn.messageId : messageId,
      ...(Array.isArray(provenanceIn.derivedFrom)
        ? { derivedFrom: provenanceIn.derivedFrom as string[] }
        : {}),
      ...(typeof provenanceIn.asOf === "string" ? { asOf: provenanceIn.asOf } : {}),
    },
  };
}

export function fixtureSessionPayload(part: Omit<CandidatePart, "candidateId" | "type"> & {
  candidateId?: string;
}): Record<string, unknown> {
  const title = titleFromPayload(part.payload, part.kind);
  return {
    type: "message",
    id: part.candidateId,
    message: {
      role: "custom",
      customType: "research_candidate",
      content: [{ type: "text", text: title }],
      details: {
        type: "research_candidate",
        schemaVersion: 1,
        kind: part.kind,
        payload: part.payload,
        provenance: part.provenance,
      },
    },
  };
}

/** Overlay research_entities onto a crEntity wire node for GET / Realtime. */
export function entityPresentation(input: {
  nodeId: string;
  entityId: string;
  entityKind: ResearchEntityKind;
  currentRevision: number;
  contentHash: string;
  status: string;
  origin: string;
  confirmed: boolean;
  stale: string | null;
  summary: string | null;
  payload: unknown;
  nativeData?: Record<string, unknown>;
}): Record<string, unknown> {
  const title = titleFromPayload(input.payload, input.summary ?? input.entityKind);
  return {
    ...(input.nativeData ?? {}),
    nodeId: input.nodeId,
    entityRef: { refId: input.entityId, refRevision: input.currentRevision },
    entityKind: input.entityKind,
    displayState: "preview",
    title,
    typeLabel: input.entityKind.toUpperCase(),
    summary: input.summary ?? summaryFromPayload(input.payload),
    keywords: [],
    status: input.status,
    confirmed: input.confirmed,
    stale: input.stale ?? false,
    evidenceState: null,
    relationCounts: { incoming: 0, outgoing: 0, unresolved: 0 },
    sourceCount: 0,
    currentRevision: input.currentRevision,
    contentHash: input.contentHash,
    origin: input.origin,
    payload: input.payload,
  };
}
