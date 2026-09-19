// Track A produce path (docs/spec/04 §3 / ticket 08).
// Writes a Pi SessionEntry CustomMessage into agent_messages. Accept
// re-reads that row; this function never touches research_entities.

import { createUuid } from "@coresearch/shared";

import {
  fixtureSessionPayload,
  isResearchEntityKind,
  type ResearchEntityKind,
} from "./candidate.js";
import type { SqlQuery } from "./sql.js";

export type ProposeCandidateInput = {
  threadId: string;
  runId: string;
  kind: unknown;
  payload: unknown;
  rationale?: string;
};

export async function proposeCandidate(
  db: SqlQuery,
  input: ProposeCandidateInput,
): Promise<{ candidateId: string }> {
  if (!isResearchEntityKind(input.kind)) {
    throw new Error(`invalid candidate kind: ${String(input.kind)}`);
  }
  const kind: ResearchEntityKind = input.kind;
  const candidateId = createUuid();
  const detailsPayload: Record<string, unknown> =
    input.payload && typeof input.payload === "object"
      ? { ...(input.payload as Record<string, unknown>) }
      : { value: input.payload };
  if (input.rationale) {
    detailsPayload.rationale = input.rationale;
  }
  const payload = fixtureSessionPayload({
    candidateId,
    schemaVersion: 1,
    kind,
    payload: detailsPayload,
    provenance: {
      runId: input.runId,
      messageId: candidateId,
      asOf: new Date().toISOString(),
    },
  });

  await db.query(
    `INSERT INTO agent_messages (id, thread_id, entry_type, payload)
     VALUES ($1::uuid, $2::uuid, 'message', $3::jsonb)`,
    [candidateId, input.threadId, JSON.stringify(payload)],
  );
  return { candidateId };
}
