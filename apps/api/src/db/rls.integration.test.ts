import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PGlite } from "@electric-sql/pglite";

import { createUser, freshDb } from "../test/pgliteHarness.js";

const userA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const userB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const projectA = "11111111-1111-1111-1111-111111111111";
const projectB = "22222222-2222-2222-2222-222222222222";

async function setup(): Promise<PGlite> {
  // Migration loading and the Supabase runtime stubs live in the shared
  // harness so a migration change is picked up by every integration test
  // at once rather than needing the same edit in each file.
  const db = await freshDb();
  await createUser(db, userA);
  await createUser(db, userB);
  await db.exec(`
    INSERT INTO projects (id, owner_user_id, title)
      VALUES
        ('${projectA}'::uuid, '${userA}'::uuid, 'A'),
        ('${projectB}'::uuid, '${userB}'::uuid, 'B');
    INSERT INTO project_members (project_id, user_id, role)
      VALUES
        ('${projectA}'::uuid, '${userA}'::uuid, 'owner'),
        ('${projectB}'::uuid, '${userB}'::uuid, 'owner');
  `);
  return db;
}

describe("RLS: coresearch_app cannot read another user's project", () => {
  it("returns only the caller's rows, not a cross-tenant leak", async () => {
    const db = await setup();
    await db.exec("BEGIN");
    await db.exec("SET LOCAL ROLE coresearch_app");
    await db.query("SELECT set_config('app.current_user_id', $1, true)", [userA]);
    const { rows } = await db.query<{ id: string; title: string }>(
      "SELECT id, title FROM projects ORDER BY title",
    );
    await db.exec("COMMIT");
    assert.deepEqual(
      rows.map((r) => r.title),
      ["A"],
    );
  });
});

describe("RLS: service_role / superuser path is not constrained", () => {
  it("sees every project without SET LOCAL", async () => {
    const db = await setup();
    const { rows } = await db.query<{ title: string }>(
      "SELECT title FROM projects ORDER BY title",
    );
    assert.deepEqual(
      rows.map((r) => r.title),
      ["A", "B"],
    );
  });
});
