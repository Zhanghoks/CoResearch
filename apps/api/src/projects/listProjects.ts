// The caller's project list (docs/spec/02-api-contract.md §1).
//
// No explicit `WHERE owner = me`: the coresearch_app RLS policy already
// restricts `projects` to rows the caller is a member of. Adding a
// redundant predicate here would invite the habit of trusting the
// application filter instead of the policy.
//
// ADR 0003 guarantees exactly one primary canvas per project in V1, but
// the same ADR anticipates a project gaining a second (Deep Dive) canvas
// later. "Primary" means the one created alongside the project, so this
// orders by creation. An earlier version used `MIN(c.id::text)`, which
// is merely single-valued, not correct: a later canvas whose uuid sorts
// first would silently hijack the link (see listProjects test).

import type { ProjectSummary } from "@coresearch/shared";

import type { RequestDb } from "../db/index.js";

export type { ProjectSummary };

export async function listProjects(db: RequestDb): Promise<ProjectSummary[]> {
  const result = await db.query<{
    id: string;
    title: string;
    canvas_id: string | null;
    created_at: string;
  }>(
    `SELECT p.id,
            p.title,
            p.created_at,
            (SELECT c.id::text
               FROM canvases c
              WHERE c.project_id = p.id
              ORDER BY c.created_at ASC, c.id ASC
              LIMIT 1) AS canvas_id
       FROM projects p
      ORDER BY p.created_at DESC`,
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    canvasId: row.canvas_id,
    createdAt: row.created_at,
  }));
}
