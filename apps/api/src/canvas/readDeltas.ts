// Durable catch-up (ADR 0002). Realtime is the fast path; this is the
// authority when localVersion and the next event's fromVersion disagree.

import type { CanvasDeltaLog } from "@coresearch/shared";

import type { RequestDb } from "../db/index.js";

export async function readDeltas(
  db: RequestDb,
  canvasId: string,
  afterVersion: number,
): Promise<CanvasDeltaLog | null> {
  const exists = await db.query(
    "SELECT 1 FROM canvases WHERE id = $1::uuid",
    [canvasId],
  );
  if (!exists.rows[0]) return null;

  const result = await db.query<{
    from_version: string | number;
    to_version: string | number;
    deltas: unknown;
  }>(
    `SELECT from_version, to_version, deltas
       FROM canvas_deltas
      WHERE canvas_id = $1::uuid AND to_version > $2
      ORDER BY to_version ASC`,
    [canvasId, afterVersion],
  );

  return {
    entries: result.rows.map((row) => ({
      fromVersion: Number(row.from_version),
      toVersion: Number(row.to_version),
      deltas: row.deltas as unknown[],
    })),
  };
}
