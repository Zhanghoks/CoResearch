import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SignJWT } from "jose";
import type { PGlite } from "@electric-sql/pglite";

import { buildApp } from "./app.js";
import { asUser, createUser, freshDb } from "./test/pgliteHarness.js";

const secret = new TextEncoder().encode(
  "test-jwt-secret-that-is-long-enough-for-hs256",
);
const issuer = "https://project.supabase.co/auth/v1";
const userA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const userB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

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

/** Wire the real routes to a real Postgres with the real policies. */
async function harness() {
  const db = await freshDb();
  await createUser(db, userA);
  await createUser(db, userB);
  const app = buildApp({
    auth: { secret, issuer },
    withRequestContext: (ctx, fn) => asUser(db, ctx.userId, fn),
  });
  return { app, db };
}

async function bearer(userId: string) {
  return { authorization: `Bearer ${await tokenFor(userId)}` };
}

describe("POST /api/projects", () => {
  it("creates a project and returns the canvas to open", async () => {
    const { app } = await harness();

    const res = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: await bearer(userA),
      payload: { title: "Protein folding" },
    });

    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.ok(body.projectId);
    assert.ok(body.canvasId);
  });

  it("rejects a request with no bearer token", async () => {
    const { app } = await harness();
    const res = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { title: "Anonymous" },
    });
    assert.equal(res.statusCode, 401);
  });

  it("rejects a forged token", async () => {
    const { app } = await harness();
    const forged = await new SignJWT({ role: "authenticated" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(issuer)
      .setAudience("authenticated")
      .setSubject(userA)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("not-the-projects-signing-secret!!"));

    const res = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: { authorization: `Bearer ${forged}` },
      payload: { title: "Forged" },
    });

    assert.equal(res.statusCode, 401);
  });

  it("does not write anything when the caller is unauthenticated", async () => {
    const { app, db } = await harness();
    await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { title: "Anonymous" },
    });
    const rows = await db.query<{ id: string }>("SELECT id FROM projects");
    assert.equal(rows.rows.length, 0);
  });
});

describe("GET /api/canvases/:canvasId", () => {
  it("loads the empty canvas of a project the caller owns", async () => {
    const { app } = await harness();
    const created = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: await bearer(userA),
      payload: { title: "Protein folding" },
    });
    const { canvasId } = created.json();

    const res = await app.inject({
      method: "GET",
      url: `/api/canvases/${canvasId}`,
      headers: await bearer(userA),
    });

    assert.equal(res.statusCode, 200);
    const canvas = res.json();
    assert.equal(canvas.canvasId, canvasId);
    assert.equal(canvas.version, 0);
    assert.deepEqual(canvas.nodes, []);
    assert.deepEqual(canvas.edges, []);
  });

  it("answers 404 — not 403 — for another user's canvas", async () => {
    const { app } = await harness();
    const created = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: await bearer(userA),
      payload: { title: "Mine" },
    });
    const { canvasId } = created.json();

    const res = await app.inject({
      method: "GET",
      url: `/api/canvases/${canvasId}`,
      headers: await bearer(userB),
    });

    assert.equal(res.statusCode, 404);
  });
});

describe("GET /api/projects", () => {
  it("lists only the caller's own projects", async () => {
    const { app } = await harness();
    await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: await bearer(userA),
      payload: { title: "A's work" },
    });

    const mine = await app.inject({
      method: "GET",
      url: "/api/projects",
      headers: await bearer(userA),
    });
    const theirs = await app.inject({
      method: "GET",
      url: "/api/projects",
      headers: await bearer(userB),
    });

    assert.equal(mine.json().length, 1);
    assert.equal(mine.json()[0].title, "A's work");
    assert.deepEqual(theirs.json(), []);
  });
});
