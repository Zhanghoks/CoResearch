import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

const userA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const userB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const projectA = "11111111-1111-1111-1111-111111111111";
const projectB = "22222222-2222-2222-2222-222222222222";

async function setup(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
    CREATE ROLE authenticated NOLOGIN;
    CREATE PUBLICATION supabase_realtime;
    -- rls.sql GRANTs coresearch_app TO postgres; PGlite's login role is postgres.
  `);
  const init = readFileSync(
    path.join(root, "supabase/migrations/00000000000001_init.sql"),
    "utf8",
  );
  const rls = readFileSync(
    path.join(root, "supabase/migrations/00000000000002_rls.sql"),
    "utf8",
  );
  await db.exec(init);
  await db.exec(rls);
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${userA}'::uuid), ('${userB}'::uuid);
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
