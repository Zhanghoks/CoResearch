import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SignJWT } from "jose";

import { buildApp } from "../app.js";
import { asUser, createUser, freshDb } from "../test/pgliteHarness.js";
import { nextSyncAction } from "@coresearch/shared";

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

async function createCanvas(app: ReturnType<typeof buildApp>) {
  const res = await app.inject({
    method: "POST",
    url: "/api/projects",
    headers: await bearer(userA),
    payload: { title: "Notes" },
  });
  return res.json() as { projectId: string; canvasId: string };
}

describe("nextSyncAction (ADR 0002 catch-up)", () => {
  it("applies a contiguous event, catches up a gap, ignores stale", () => {
    assert.equal(nextSyncAction(3, 3, 4), "apply");
    assert.equal(nextSyncAction(3, 5, 6), "catch-up");
    assert.equal(nextSyncAction(5, 3, 4), "ignore");
  });
});

describe("POST /api/canvases/:id/execute", () => {
  it("creates, moves, edits and deletes a note, persisted across GET", async () => {
    const { app } = await harness();
    const { canvasId } = await createCanvas(app);
    const headers = await bearer(userA);

    const created = await app.inject({
      method: "POST",
      url: `/api/canvases/${canvasId}/execute`,
      headers,
      payload: {
        commands: [
          {
            type: "CREATE_NODES",
            nodes: [
              {
                nodeType: "note",
                position: { x: 10, y: 20 },
                data: { content: "hello" },
              },
            ],
          },
        ],
      },
    });
    assert.equal(created.statusCode, 200);
    const createdBody = created.json();
    assert.equal(createdBody.version, 1);
    assert.equal(createdBody.commandResults[0].applied, true);
    const nodeId = createdBody.deltas.find(
      (d: { type: string }) => d.type === "INSERT_NODE",
    )?.node.id as string;
    assert.match(nodeId, /^[0-9a-f-]{36}$/i);
    const inserted = createdBody.deltas.find(
      (d: { type: string }) => d.type === "INSERT_NODE",
    ) as { node: Record<string, unknown> };
    assert.equal("selected" in inserted.node, false);
    assert.equal("dragging" in inserted.node, false);

    const moved = await app.inject({
      method: "POST",
      url: `/api/canvases/${canvasId}/execute`,
      headers,
      payload: {
        commands: [
          {
            type: "SET_NODE_GEOMETRY",
            items: [{ nodeId, position: { x: 100, y: 200 } }],
          },
        ],
      },
    });
    assert.equal(moved.json().version, 2);

    const edited = await app.inject({
      method: "POST",
      url: `/api/canvases/${canvasId}/execute`,
      headers,
      payload: {
        commands: [
          {
            type: "MERGE_NODE_DATA",
            patches: [{ nodeId, patch: { content: "edited" } }],
          },
        ],
      },
    });
    assert.equal(edited.json().version, 3);

    const loaded = await app.inject({
      method: "GET",
      url: `/api/canvases/${canvasId}`,
      headers,
    });
    const snap = loaded.json();
    assert.equal(snap.version, 3);
    assert.equal(snap.nodes.length, 1);
    assert.equal(snap.nodes[0].position.x, 100);
    assert.equal(snap.nodes[0].data.content, "edited");

    const deleted = await app.inject({
      method: "POST",
      url: `/api/canvases/${canvasId}/execute`,
      headers,
      payload: {
        commands: [{ type: "DELETE_NODES", nodeIds: [nodeId] }],
      },
    });
    assert.equal(deleted.json().version, 4);
    const empty = await app.inject({
      method: "GET",
      url: `/api/canvases/${canvasId}`,
      headers,
    });
    assert.equal(empty.json().nodes.length, 0);
  });

  it("does not bump version when the batch is a no-op", async () => {
    const { app } = await harness();
    const { canvasId } = await createCanvas(app);
    const res = await app.inject({
      method: "POST",
      url: `/api/canvases/${canvasId}/execute`,
      headers: await bearer(userA),
      payload: {
        commands: [{ type: "DELETE_NODES", nodeIds: ["00000000-0000-0000-0000-000000000001"] }],
      },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().version, 0);
    assert.equal(res.json().deltas.length, 0);
  });

  it("rejects another user's canvas with 404", async () => {
    const { app } = await harness();
    const { canvasId } = await createCanvas(app);
    const res = await app.inject({
      method: "POST",
      url: `/api/canvases/${canvasId}/execute`,
      headers: await bearer(userB),
      payload: { commands: [{ type: "CREATE_NODES", nodes: [] }] },
    });
    assert.equal(res.statusCode, 404);
  });
});

describe("GET /api/canvases/:id/deltas catch-up", () => {
  it("returns the gap after afterVersion", async () => {
    const { app } = await harness();
    const { canvasId } = await createCanvas(app);
    const headers = await bearer(userA);

    await app.inject({
      method: "POST",
      url: `/api/canvases/${canvasId}/execute`,
      headers,
      payload: {
        commands: [
          {
            type: "CREATE_NODES",
            nodes: [{ nodeType: "note", position: { x: 0, y: 0 } }],
          },
        ],
      },
    });
    await app.inject({
      method: "POST",
      url: `/api/canvases/${canvasId}/execute`,
      headers,
      payload: {
        commands: [
          {
            type: "CREATE_NODES",
            nodes: [{ nodeType: "note", position: { x: 1, y: 1 } }],
          },
        ],
      },
    });

    const gap = await app.inject({
      method: "GET",
      url: `/api/canvases/${canvasId}/deltas?afterVersion=0`,
      headers,
    });
    assert.equal(gap.statusCode, 200);
    const log = gap.json();
    assert.equal(log.entries.length, 2);
    assert.equal(log.entries[0].fromVersion, 0);
    assert.equal(log.entries[0].toVersion, 1);
    assert.equal(log.entries[1].fromVersion, 1);
    assert.equal(log.entries[1].toVersion, 2);

    const afterFirst = await app.inject({
      method: "GET",
      url: `/api/canvases/${canvasId}/deltas?afterVersion=1`,
      headers,
    });
    assert.equal(afterFirst.json().entries.length, 1);
    assert.equal(afterFirst.json().entries[0].fromVersion, 1);
  });
});
