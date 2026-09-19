// Request-scoped Postgres access for `coresearch_app`.
//
// ADR 0013: every `coresearch_app` query runs inside one transaction that
// first `SET LOCAL app.current_user_id`. `SET` (non-LOCAL) is forbidden —
// pooled connections would leak the previous request's identity.
//
// The pool itself is not exported. Production code obtains a client only
// through `withRequestContext` (user requests) or `withServiceRole`
// (projector / migration). `pg` is restricted to this directory by eslint.

import pg from "pg";

export type RequestContext = {
  userId: string;
};

/**
 * The only query handle production code is allowed to hold. Obtained
 * exclusively from `withRequestContext` / `withServiceRole`.
 */
export type RequestDb = {
  readonly query: pg.PoolClient["query"];
};

let appPool: pg.Pool | undefined;
let servicePool: pg.Pool | undefined;

function connectionString(envName: string): string {
  const value = process.env[envName];
  if (!value) {
    throw new Error(`${envName} is not set`);
  }
  return value;
}

function getAppPool(): pg.Pool {
  if (!appPool) {
    appPool = new pg.Pool({
      connectionString: connectionString("CORESEARCH_APP_DATABASE_URL"),
    });
  }
  return appPool;
}

function getServicePool(): pg.Pool {
  if (!servicePool) {
    servicePool = new pg.Pool({
      connectionString: connectionString("CORESEARCH_SERVICE_DATABASE_URL"),
    });
  }
  return servicePool;
}

function asRequestDb(client: pg.PoolClient): RequestDb {
  return { query: client.query.bind(client) as pg.PoolClient["query"] };
}

export async function withRequestContext<T>(
  ctx: RequestContext,
  fn: (db: RequestDb) => Promise<T>,
): Promise<T> {
  if (!ctx.userId) {
    throw new Error("withRequestContext: userId is required");
  }
  const client = await getAppPool().connect();
  try {
    await client.query("BEGIN");
    // Drop BYPASSRLS for this transaction. The login role is GRANTed
    // coresearch_app (see 00000000000002_rls.sql); SET LOCAL so the
    // pooled connection is restored on COMMIT/ROLLBACK.
    await client.query("SET LOCAL ROLE coresearch_app");
    // set_config(..., true) == SET LOCAL. Never SET.
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [
      ctx.userId,
    ]);
    const result = await fn(asRequestDb(client));
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure; the original error is what matters
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Projector / migration path. Connects as a BYPASSRLS role
 * (`CORESEARCH_SERVICE_DATABASE_URL`, typically Supabase `service_role`
 * / postgres). Does not set `app.current_user_id`.
 */
export async function withServiceRole<T>(
  fn: (db: RequestDb) => Promise<T>,
): Promise<T> {
  const client = await getServicePool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(asRequestDb(client));
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Test-only: inject pools so RLS tests can use PGlite's `pg` compatibility. */
export function _setPoolsForTest(pools: {
  app?: pg.Pool;
  service?: pg.Pool;
}): void {
  if (pools.app) appPool = pools.app;
  if (pools.service) servicePool = pools.service;
}
