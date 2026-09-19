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
