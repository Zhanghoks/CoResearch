// Create a Project and its primary Canvas.
//
// ADR 0003: a Project owns 1..N Canvases in the data model, but V1
// creates exactly one "primary" canvas per project and offers no UI to
// add or switch. So project creation and canvas creation are one
// operation, not two.
//
// The insert ORDER is forced by the RLS policies in
// 00000000000002_rls.sql, not by preference:
//   1. projects         — INSERT policy checks owner_user_id = me
//   2. project_members  — INSERT policy checks I own that project_id,
//                         so the projects row must already exist
//   3. canvases         — `FOR ALL USING (project_id IN my memberships)`
//                         doubles as the INSERT check, so the membership
//                         row must already exist
// Reordering these makes the transaction fail closed. The caller supplies
// the transaction (withRequestContext), so a failure at any step rolls
// back all three.

import type { RequestDb } from "../db/index.js";

export type CreateProjectInput = {
  userId: string;
  title: string;
};

export type CreatedProject = {
  projectId: string;
  canvasId: string;
};

export async function createProject(
  db: RequestDb,
  input: CreateProjectInput,
): Promise<CreatedProject> {
  const project = await db.query<{ id: string }>(
    "INSERT INTO projects (owner_user_id, title) VALUES ($1::uuid, $2) RETURNING id",
    [input.userId, input.title],
  );
  const projectId = project.rows[0]!.id;

  await db.query(
    "INSERT INTO project_members (project_id, user_id, role) VALUES ($1::uuid, $2::uuid, 'owner')",
    [projectId, input.userId],
  );

  const canvas = await db.query<{ id: string }>(
    "INSERT INTO canvases (project_id) VALUES ($1::uuid) RETURNING id",
    [projectId],
  );

  return { projectId, canvasId: canvas.rows[0]!.id };
}
