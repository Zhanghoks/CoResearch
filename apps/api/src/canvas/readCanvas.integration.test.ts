import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readCanvas } from "./readCanvas.js";
import { createProject } from "../projects/createProject.js";
import { asUser, createUser, freshDb } from "../test/pgliteHarness.js";

const userA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const userB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("readCanvas", () => {
  it("loads a newly created canvas as an empty board, not an error", async () => {
    const db = await freshDb();
    await createUser(db, userA);
    const created = await asUser(db, userA, (tx) =>
      createProject(tx, { userId: userA, title: "Protein folding" }),
    );

    const canvas = await asUser(db, userA, (tx) =>
      readCanvas(tx, created.canvasId),
    );

    assert.equal(canvas?.canvasId, created.canvasId);
    assert.equal(canvas?.projectId, created.projectId);
    assert.equal(canvas?.version, 0);
    assert.deepEqual(canvas?.nodes, []);
    assert.deepEqual(canvas?.edges, []);
    // Carried so a deep link to /canvas/:id can render its header
    // without a second request or in-memory state from the list page.
    assert.equal(canvas?.projectTitle, "Protein folding");
  });

  it("does not reveal a canvas belonging to another user's project", async () => {
    const db = await freshDb();
    await createUser(db, userA);
    await createUser(db, userB);
    const mine = await asUser(db, userA, (tx) =>
      createProject(tx, { userId: userA, title: "Mine" }),
    );

    const seenByB = await asUser(db, userB, (tx) =>
      readCanvas(tx, mine.canvasId),
    );

    // Absent, not a permission error: the route maps this to 404 so we
    // never confirm that the id exists (cross-tenant existence leak).
    assert.equal(seenByB, null);
  });
});
