// Persist Pi SessionEntry rows as-is (ADR 0011). Row `id` is a UUID
// column; Pi's own entry ids are often 8-char hex, so those live only
// inside `payload`. Candidate rows already use a UUID that matches
// payload.id (ADR 0005) and are skipped on re-persist.

import { createUuid } from "@coresearch/shared";

import type { SqlQuery } from "./sql.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export async function persistSessionEntries(
  db: SqlQuery,
  threadId: string,
  entries: unknown[],
): Promise<number> {
  const existing = await db.query(
    `SELECT id, payload FROM agent_messages WHERE thread_id = $1::uuid`,
    [threadId],
  );
  const seen = new Set<string>();
  for (const row of existing.rows) {
    seen.add(String(row.id));
    const payload = row.payload;
    if (payload && typeof payload === "object" && "id" in payload) {
      const pid = (payload as { id?: unknown }).id;
      if (typeof pid === "string") seen.add(pid);
    }
  }

  let inserted = 0;
  for (const raw of entries) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    if (entry.type === "session") continue;
    const entryId = typeof entry.id === "string" ? entry.id : null;
    if (entryId && seen.has(entryId)) continue;

    const rowId = entryId && isUuid(entryId) ? entryId : createUuid();
    if (seen.has(rowId)) continue;

    const parentRaw = typeof entry.parentId === "string" ? entry.parentId : null;
    const parentId = parentRaw && isUuid(parentRaw) ? parentRaw : null;
    const entryType = typeof entry.type === "string" ? entry.type : "message";

    await db.query(
      `INSERT INTO agent_messages (id, thread_id, parent_id, entry_type, payload)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [rowId, threadId, parentId, entryType, JSON.stringify(entry)],
    );
    seen.add(rowId);
    if (entryId) seen.add(entryId);
    inserted += 1;
  }
  return inserted;
}
