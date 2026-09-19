import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  _setPoolsForTest,
  withRequestContext,
  withServiceRole,
} from "./withRequestContext.js";

type QueryFn = (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;

function fakePool(query: QueryFn) {
  return {
    connect: async () => ({
      query,
      release: () => {},
    }),
  };
}

describe("withRequestContext", () => {
  it("opens a transaction, SET LOCAL via set_config(..., true), then COMMIT", async () => {
    const calls: { sql: string; params?: unknown[] }[] = [];
    const query: QueryFn = async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [] };
    };
    _setPoolsForTest({ app: fakePool(query) as never });

    const value = await withRequestContext(
      { userId: "11111111-1111-1111-1111-111111111111" },
      async (db) => {
        await db.query("SELECT 1");
        return 42;
      },
    );

    assert.equal(value, 42);
    assert.equal(calls[0]?.sql, "BEGIN");
    assert.match(calls[1]?.sql ?? "", /SET LOCAL ROLE coresearch_app/);
    assert.match(calls[2]?.sql ?? "", /set_config\('app\.current_user_id'/);
    assert.equal(calls[2]?.params?.[0], "11111111-1111-1111-1111-111111111111");
    assert.match(calls[2]?.sql ?? "", /,\s*true\)/);
    assert.equal(
      calls.some((c) => /^\s*SET\s+(?!LOCAL)/i.test(c.sql)),
      false,
    );
    assert.equal(calls.at(-1)?.sql, "COMMIT");
  });

  it("rejects a missing userId before touching the pool", async () => {
    await assert.rejects(
      () => withRequestContext({ userId: "" }, async () => undefined),
      /userId is required/,
    );
  });
});

describe("withServiceRole", () => {
  it("does not set app.current_user_id", async () => {
    const calls: string[] = [];
    const query: QueryFn = async (sql) => {
      calls.push(sql);
      return { rows: [] };
    };
    _setPoolsForTest({ service: fakePool(query) as never });

    await withServiceRole(async (db) => {
      await db.query("SELECT 1");
    });

    assert.equal(
      calls.some((sql) => sql.includes("app.current_user_id")),
      false,
    );
  });
});
