import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createProject } from "./createProject.js";
import { listProjects } from "./listProjects.js";
import { asUser, createUser, freshDb } from "../test/pgliteHarness.js";

const userA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const userB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("listProjects", () => {
  it("returns the caller's projects with the primary canvas to open", async () => {
    const db = await freshDb();
    await createUser(db, userA);
    const created = await asUser(db, userA, (tx) =>
      createProject(tx, { userId: userA, title: "Protein folding" }),
    );

    const projects = await asUser(db, userA, (tx) => listProjects(tx));

    assert.equal(projects.length, 1);
    assert.equal(projects[0]?.id, created.projectId);
    assert.equal(projects[0]?.title, "Protein folding");
    // Without this the client would need a second round trip just to
    // open the board it already knows it wants.
    assert.equal(projects[0]?.canvasId, created.canvasId);
  });

  it("points at the first canvas created, not an arbitrary one", async () => {
    // ADR 0003 allows a project to gain a second canvas later (a Deep
    // Dive board). "Primary" means the one created with the project, so
    // ordering must be by creation, not by whichever uuid happens to
    // sort first.
    const db = await freshDb();
    await createUser(db, userA);
    const created = await asUser(db, userA, (tx) =>
      createProject(tx, { userId: userA, title: "Two canvases" }),
    );

    // A later canvas whose uuid sorts BEFORE the primary one: with
    // lexicographic ordering this would hijack the link.
    await asUser(db, userA, (tx) =>
      tx.query(
        `INSERT INTO canvases (id, project_id, title, created_at)
         VALUES ('00000000-0000-0000-0000-00000000000a'::uuid, $1::uuid, 'Deep dive', now() + interval '1 hour')`,
        [created.projectId],
      ),
    );

    const projects = await asUser(db, userA, (tx) => listProjects(tx));

    assert.equal(projects[0]?.canvasId, created.canvasId);
  });

  it("omits projects belonging to other users", async () => {
    const db = await freshDb();
    await createUser(db, userA);
    await createUser(db, userB);
    await asUser(db, userA, (tx) =>
      createProject(tx, { userId: userA, title: "Mine" }),
    );

    const seenByB = await asUser(db, userB, (tx) => listProjects(tx));

    assert.deepEqual(seenByB, []);
  });
});
