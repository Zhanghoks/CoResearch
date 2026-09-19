import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SignJWT } from "jose";
import { claimNextRun } from "@coresearch/research";

import { buildApp } from "../app.js";
import { asUser, createUser, freshDb } from "../test/pgliteHarness.js";

import type { CreatedRun, CreatedThread } from "@coresearch/shared";

const secret = new TextEncoder().encode(
  "test-jwt-secret-that-is-long-enough-for-hs256",
);
const issuer = "https://project.supabase.co/auth/v1";
const userA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

async function tokenFor(userId: string): Promise<string> {
  return new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer)
    .setAudience("authenticated")
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

async function harness() {
  const db = await freshDb();
  await createUser(db, userA);
  const app = buildApp({
    auth: { secret, issuer },
    withRequestContext: (ctx, fn) => asUser(db, ctx.userId, fn),
  });
  return { app, db };
}

async function queuedRun(app: ReturnType<typeof buildApp>) {
  const headers = { authorization: `Bearer ${await tokenFor(userA)}` };
  const project = await app.inject({
    method: "POST",
    url: "/api/projects",
    headers,
    payload: { title: "Lease" },
  });
  const { projectId } = project.json() as { projectId: string };
  const thread = await app.inject({
    method: "POST",
    url: `/api/projects/${projectId}/threads`,
    headers,
  });
  const { threadId } = thread.json() as CreatedThread;
  const run = await app.inject({
    method: "POST",
    url: `/api/threads/${threadId}/runs`,
    headers,
    payload: { prompt: "work" },
  });
  const body = run.json() as CreatedRun;
  return { headers, runId: body.runId };
}

describe("agent_runs claim / cancel (ticket 10)", () => {
  it("two workers cannot claim the same queued run", async () => {
    const { app, db } = await harness();
    const { runId } = await queuedRun(app);

    const first = await asUser(db, userA, (rdb) => claimNextRun(rdb, "worker-a"));
    const second = await asUser(db, userA, (rdb) => claimNextRun(rdb, "worker-b"));

    assert.ok(first);
    assert.equal(first.id, runId);
    assert.equal(first.leaseOwner, "worker-a");
    assert.equal(second, null);
  });

  it("an expired lease is reclaimable by another worker", async () => {
    const { app, db } = await harness();
    const { runId } = await queuedRun(app);

    const first = await asUser(db, userA, (rdb) => claimNextRun(rdb, "worker-a"));
    assert.ok(first);
    await db.query(
      `UPDATE agent_runs
          SET lease_expires_at = now() - interval '1 second'
        WHERE id = $1::uuid`,
      [runId],
    );

    const stolen = await asUser(db, userA, (rdb) => claimNextRun(rdb, "worker-b"));
    assert.ok(stolen);
    assert.equal(stolen.id, runId);
    assert.equal(stolen.leaseOwner, "worker-b");
  });

  it("POST cancel sets cancel_requested without waiting for the worker", async () => {
    const { app, db } = await harness();
    const { headers, runId } = await queuedRun(app);

    const cancel = await app.inject({
      method: "POST",
      url: `/api/runs/${runId}/cancel`,
      headers,
    });
    assert.equal(cancel.statusCode, 200);
    const row = await db.query<{ cancel_requested: boolean }>(
      "SELECT cancel_requested FROM agent_runs WHERE id = $1::uuid",
      [runId],
    );
    assert.equal(row.rows[0]?.cancel_requested, true);
  });
});
