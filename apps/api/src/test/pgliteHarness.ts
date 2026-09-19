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

import { _setPoolsForTest, withRequestContext } from "../db/withRequestContext.js";

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
 * Run `fn` as `userId`, through the REAL `withRequestContext`.
 *
 * Deliberately not a re-implementation of the BEGIN / SET LOCAL ROLE /
 * SET LOCAL app.current_user_id sequence: ADR 0013 makes that sequence
 * the single fail-closed choke point, and a hand-copy here would keep
 * passing if production ever gained a step. Instead PGlite is adapted to
 * the narrow slice of `pg.Pool` that `withRequestContext` uses, and
 * injected via the escape hatch the module already exports.
 */
export async function asUser<T>(
  db: PGlite,
  userId: string,
  fn: (db: RequestDb) => Promise<T>,
): Promise<T> {
  _setPoolsForTest({ app: asPool(db) });
  return withRequestContext({ userId }, fn);
}

/** The slice of `pg.Pool` that `withRequestContext` actually touches. */
function asPool(db: PGlite) {
  return {
    connect: async () => ({
      query: (sql: string, params?: unknown[]) => db.query(sql, params),
      release: () => {},
    }),
  } as never;
}
