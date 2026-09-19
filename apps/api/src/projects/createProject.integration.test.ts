import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createProject } from "./createProject.js";
import { asUser, createUser, freshDb } from "../test/pgliteHarness.js";

const userA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const userB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("createProject", () => {
  it("creates the project, the owner membership and one primary canvas", async () => {
    const db = await freshDb();
    await createUser(db, userA);

    const created = await asUser(db, userA, (tx) =>
      createProject(tx, { userId: userA, title: "Protein folding" }),
    );

    // Read back as the owner, through RLS — the rows must be visible to
    // the user who created them, which is the actual product requirement
    // (ADR 0003: every project gets exactly one primary canvas).
    const seen = await asUser(db, userA, async (tx) => {
      const projects = await tx.query<{ id: string; title: string }>(
        "SELECT id, title FROM projects",
      );
      const members = await tx.query<{ user_id: string; role: string }>(
        "SELECT user_id, role FROM project_members WHERE project_id = $1",
        [created.projectId],
      );
      const canvases = await tx.query<{ id: string; project_id: string }>(
        "SELECT id, project_id FROM canvases WHERE project_id = $1",
        [created.projectId],
      );
      return { projects: projects.rows, members: members.rows, canvases: canvases.rows };
    });

    assert.equal(seen.projects.length, 1);
    assert.equal(seen.projects[0]?.title, "Protein folding");
    assert.equal(seen.members.length, 1);
    assert.equal(seen.members[0]?.user_id, userA);
    assert.equal(seen.members[0]?.role, "owner");
    assert.equal(seen.canvases.length, 1);
    assert.equal(seen.canvases[0]?.id, created.canvasId);
  });

  it("cannot mint a project owned by a different user", async () => {
    // There is no service-role path here: createProject always runs as
    // coresearch_app, so a mismatched owner_user_id is refused by the
    // projects INSERT policy rather than silently trusted.
    const db = await freshDb();
    await createUser(db, userA);
    await createUser(db, userB);

    await assert.rejects(() =>
      asUser(db, userA, (tx) =>
        createProject(tx, { userId: userB, title: "Not mine to make" }),
      ),
    );

    const rows = await db.query<{ id: string }>("SELECT id FROM projects");
    assert.equal(rows.rows.length, 0);
  });
});
