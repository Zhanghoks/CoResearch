// The caller's project list (docs/spec/02-api-contract.md §1).
//
// No explicit `WHERE owner = me`: the coresearch_app RLS policy already
// restricts `projects` to rows the caller is a member of. Adding a
// redundant predicate here would invite the habit of trusting the
// application filter instead of the policy.
//
// ADR 0003 guarantees exactly one primary canvas per project in V1, so
// the join is 1:1 today. `MIN(id)` keeps it single-valued if a project
// ever gains a second canvas before the UI can express that.

import type { RequestDb } from "../db/index.js";

export type ProjectSummary = {
  id: string;
  title: string;
  canvasId: string | null;
  createdAt: string;
};

export async function listProjects(db: RequestDb): Promise<ProjectSummary[]> {
  const result = await db.query<{
    id: string;
    title: string;
    canvas_id: string | null;
    created_at: string;
  }>(
    `SELECT p.id, p.title, p.created_at, MIN(c.id::text) AS canvas_id
       FROM projects p
       LEFT JOIN canvases c ON c.project_id = p.id
      GROUP BY p.id, p.title, p.created_at
      ORDER BY p.created_at DESC`,
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    canvasId: row.canvas_id,
    createdAt: row.created_at,
  }));
}
