import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createProject } from "../projects/createProject.js";
import { asUser, createUser, freshDb } from "../test/pgliteHarness.js";
import { persistDeltas } from "./state.js";

const userA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const someNodeId = "11111111-1111-1111-1111-111111111111";

async function projectWithCanvas() {
  const db = await freshDb();
  await createUser(db, userA);
  const created = await asUser(db, userA, (tx) =>
    createProject(tx, { userId: userA, title: "versioning" }),
  );
  return { db, ...created };
}

describe("persistDeltas version CAS", () => {
  it("refuses to log a delta when the version it was computed against has moved", async () => {
    // The advisory lock serialises writers on one canvas, so a stale
    // fromVersion should be unreachable today. But ticket 06's accept
    // path is a SECOND writer that bumps canvases.version, and any
    // writer that forgets the lock would land here. Failing loudly is
    // the difference between a rolled-back transaction and a delta log
    // that permanently disagrees with the canvas it describes: a client
    // catching up would replay an entry the canvas never reflected.
    const { db, canvasId } = await projectWithCanvas();

    await assert.rejects(
      () =>
        asUser(db, userA, (tx) =>
          // Canvas is at version 0; claim we read it at 7.
          persistDeltas(tx, canvasId, 7, 8, [
            {
              type: "DELETE_NODE",
              node: {
                id: someNodeId,
                type: "note",
                position: { x: 0, y: 0 },
                data: {},
              },
            } as never,
          ]),
        ),
      /version/i,
    );

    const after = await asUser(db, userA, async (tx) => {
      const version = await tx.query<{ version: string }>(
        "SELECT version FROM canvases WHERE id = $1::uuid",
        [canvasId],
      );
      const deltas = await tx.query<{ to_version: string }>(
        "SELECT to_version FROM canvas_deltas WHERE canvas_id = $1::uuid",
        [canvasId],
      );
      return { version: version.rows[0]?.version, deltas: deltas.rows };
    });

    assert.equal(Number(after.version), 0);
    // The whole transaction rolled back, so no orphan log row survives.
    assert.deepEqual(after.deltas, []);
  });

  it("advances the version and logs exactly one row on a matching CAS", async () => {
    const { db, canvasId } = await projectWithCanvas();

    await asUser(db, userA, (tx) =>
      persistDeltas(tx, canvasId, 0, 1, [
        {
          type: "DELETE_NODE",
          node: {
            id: someNodeId,
            type: "note",
            position: { x: 0, y: 0 },
            data: {},
          },
        } as never,
      ]),
    );

    const after = await asUser(db, userA, async (tx) => {
      const version = await tx.query<{ version: string }>(
        "SELECT version FROM canvases WHERE id = $1::uuid",
        [canvasId],
      );
      const deltas = await tx.query<{ to_version: string }>(
        "SELECT to_version FROM canvas_deltas WHERE canvas_id = $1::uuid",
        [canvasId],
      );
      return { version: version.rows[0]?.version, deltas: deltas.rows };
    });

    assert.equal(Number(after.version), 1);
    assert.equal(after.deltas.length, 1);
    assert.equal(Number(after.deltas[0]?.to_version), 1);
  });
});
