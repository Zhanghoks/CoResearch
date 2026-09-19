// PGlite-backed harness for tests that must run against real RLS.
//
// The migrations are the source of truth: these tests load
// 00000000000001_init.sql + 00000000000002_rls.sql verbatim, so a policy
// that only works on the developer's machine fails here too. PGlite has no
// Supabase runtime, so `auth.users` / `auth.uid()` / the `authenticated`
// role / the realtime publication are stubbed to the shapes the migrations
// expect.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";

import type { RequestDb } from "../db/index.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

function migration(name: string): string {
  return readFileSync(
    path.join(repoRoot, "supabase/migrations", name),
    "utf8",
  );
}

/** Boot an in-memory Postgres with the real migrations applied. */
export async function freshDb(): Promise<PGlite> {
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
  `);
  await db.exec(migration("00000000000001_init.sql"));
  await db.exec(migration("00000000000002_rls.sql"));
  return db;
}

/** Register a Supabase auth user so `owner_user_id` FKs resolve. */
export async function createUser(db: PGlite, userId: string): Promise<void> {
  await db.query("INSERT INTO auth.users (id) VALUES ($1::uuid)", [userId]);
}

/**
 * Run `fn` exactly the way `withRequestContext` does in production —
 * one transaction, `SET LOCAL ROLE coresearch_app`, `SET LOCAL
 * app.current_user_id` — but against PGlite instead of a pg Pool.
 * Pool plumbing is covered separately in withRequestContext.test.ts.
 */
export async function asUser<T>(
  db: PGlite,
  userId: string,
  fn: (db: RequestDb) => Promise<T>,
): Promise<T> {
  await db.exec("BEGIN");
  try {
    await db.exec("SET LOCAL ROLE coresearch_app");
    await db.query("SELECT set_config('app.current_user_id', $1, true)", [
      userId,
    ]);
    const result = await fn(asRequestDb(db));
    await db.exec("COMMIT");
    return result;
  } catch (err) {
    await db.exec("ROLLBACK");
    throw err;
  }
}

function asRequestDb(db: PGlite): RequestDb {
  return {
    query: ((sql: string, params?: unknown[]) =>
      db.query(sql, params as unknown[])) as RequestDb["query"],
  };
}
