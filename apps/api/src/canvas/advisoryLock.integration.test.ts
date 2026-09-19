import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { asUser, createUser, freshDb } from "../test/pgliteHarness.js";
import { createProject } from "../projects/createProject.js";
import { withCanvasMutex } from "./advisoryLock.js";

const userA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("withCanvasMutex", () => {
  it("takes a transaction-scoped advisory lock for the canvas id", async () => {
    const db = await freshDb();
    await createUser(db, userA);
    const created = await asUser(db, userA, (tx) =>
      createProject(tx, { userId: userA, title: "Lock" }),
    );

    await asUser(db, userA, async (tx) => {
      await withCanvasMutex(tx, created.canvasId, async () => {
        const locks = await tx.query<{ granted: boolean; locktype: string }>(
          `SELECT granted, locktype FROM pg_locks WHERE locktype = 'advisory'`,
        );
        assert.ok(
          locks.rows.some((row) => row.granted && row.locktype === "advisory"),
          "expected an advisory lock while the mutex callback runs",
        );
      });
    });
  });
});
