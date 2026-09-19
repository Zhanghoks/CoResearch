// Canvas write lock (ADR 0002).
// Huabu's withCanvasMutex was an in-process promise chain. Here the
// lock is a transaction-scoped Postgres advisory lock on canvasId, so
// it holds across API instances. Caller must already be inside
// withRequestContext's transaction — COMMIT releases the lock.

import type { RequestDb } from "../db/index.js";

export async function withCanvasMutex<T>(
  db: RequestDb,
  canvasId: string,
  task: () => Promise<T>,
): Promise<T> {
  await db.query(
    `SELECT pg_advisory_xact_lock(
       ('x' || substr(md5($1::text), 1, 16))::bit(64)::bigint
     )`,
    [canvasId],
  );
  return task();
}
