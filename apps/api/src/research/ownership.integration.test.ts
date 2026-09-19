import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SignJWT } from "jose";

import { buildApp } from "../app.js";
import { asUser, createUser, freshDb } from "../test/pgliteHarness.js";
import {
  contentHash,
  executeAsProjector,
  executeFromRequest,
} from "@coresearch/research";
import { reconcileProjectionOnce } from "./projector.js";

import type { AcceptCandidateResult, CandidatePart } from "@coresearch/shared";

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

async function acceptedNode(app: ReturnType<typeof buildApp>) {
  const created = await app.inject({
    method: "POST",
    url: "/api/projects",
    headers: await bearer(userA),
    payload: { title: "Ownership" },
  });
  const { projectId, canvasId } = created.json() as {
    projectId: string;
    canvasId: string;
  };
  const fixture = await app.inject({
    method: "POST",
    url: `/api/projects/${projectId}/candidates/fixture`,
    headers: await bearer(userA),
  });
  const candidate = fixture.json() as CandidatePart;
  const accepted = await app.inject({
    method: "POST",
    url: `/api/projects/${projectId}/candidates/${candidate.candidateId}/accept`,
    headers: await bearer(userA),
    payload: { canvasId, placement: { position: { x: 40, y: 80 } } },
  });
  const body = accepted.json() as AcceptCandidateResult;
  return { projectId, canvasId, candidate, body };
}

describe("executeFromRequest entry (not a source parameter)", () => {
  it("rejects owned keys when the caller forges source:system", async () => {
    let hostCalled = false;
    const result = await executeFromRequest(
      {
        applyMerge: async () => {
          hostCalled = true;
          return { applied: true };
        },
      },
      {
        nodeId: "00000000-0000-0000-0000-000000000001",
        patch: { status: "confirmed" },
        source: "system",
      },
    );
    assert.equal(result.applied, false);
    assert.equal(result.reason, "invalid-scope");
    assert.equal(hostCalled, false);
  });

  it("lets executeAsProjector apply the same owned-field change", async () => {
    const result = await executeAsProjector(
      { applyPlan: async () => ({ applied: true }) },
      {
        canvasId: "c",
        createInputs: [],
        deleteNodeIds: [],
        mergePatches: [
          {
            nodeId: "00000000-0000-0000-0000-000000000001",
            patch: { status: "confirmed" },
          },
        ],
        connectInputs: [],
      },
    );
    assert.equal(result.applied, true);
  });
});

describe("crEntity ownership (ticket 07)", () => {
  it("rejects MERGE of RESEARCH_OWNED keys with invalid-scope and does not bump version", async () => {
    const { app, db } = await harness();
    const { canvasId, body } = await acceptedNode(app);
    const headers = await bearer(userA);

    const before = await db.query<{ status: string; summary: string | null }>(
      "SELECT status, summary FROM research_entities WHERE id = $1::uuid",
      [body.entityId],
    );

    const res = await app.inject({
      method: "POST",
      url: `/api/canvases/${canvasId}/execute`,
      headers,
      payload: {
        commands: [
          {
            type: "MERGE_NODE_DATA",
            patches: [
              {
                nodeId: body.nodeId,
                patch: { entityKind: "seed", status: "confirmed", confirmed: true },
              },
            ],
          },
        ],
      },
    });
    assert.equal(res.statusCode, 200);
    const out = res.json();
    assert.equal(out.version, 1);
    assert.equal(out.deltas.length, 0);
    assert.equal(out.commandResults[0].applied, false);
    assert.equal(out.commandResults[0].reason, "invalid-scope");

    const after = await db.query<{ status: string; summary: string | null }>(
      "SELECT status, summary FROM research_entities WHERE id = $1::uuid",
      [body.entityId],
    );
    assert.deepEqual(after.rows[0], before.rows[0]);
  });

  it("applies a userNote merge to native_data without touching the entity or layout", async () => {
    const { app, db } = await harness();
    const { canvasId, body } = await acceptedNode(app);
    const headers = await bearer(userA);

    const res = await app.inject({
      method: "POST",
      url: `/api/canvases/${canvasId}/execute`,
      headers,
      payload: {
        commands: [
          {
            type: "MERGE_NODE_DATA",
            patches: [{ nodeId: body.nodeId, patch: { userNote: "keep this" } }],
          },
        ],
      },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().version, 2);
    assert.equal(res.json().commandResults[0].applied, true);

    const native = await db.query<{ native_data: Record<string, unknown> }>(
      "SELECT native_data FROM canvas_nodes WHERE id = $1::uuid",
      [body.nodeId],
    );
    assert.equal(native.rows[0]?.native_data.userNote, "keep this");
    assert.equal(native.rows[0]?.native_data.status, undefined);

    const layout = await db.query<{ x: number; y: number }>(
      "SELECT x, y FROM canvas_layout WHERE node_id = $1::uuid",
      [body.nodeId],
    );
    assert.equal(layout.rows[0]?.x, 40);
    assert.equal(layout.rows[0]?.y, 80);

    const entity = await db.query<{ status: string }>(
      "SELECT status FROM research_entities WHERE id = $1::uuid",
      [body.entityId],
    );
    assert.equal(entity.rows[0]?.status, "proposed");
  });

  it("refreshes the same nodeId after an entity revision, leaving layout and node count alone", async () => {
    const { app, db } = await harness();
    const { canvasId, body } = await acceptedNode(app);
    const headers = await bearer(userA);

    const nextPayload = {
      title: "Attribution under uncertainty",
      summary: "revised after a literature pass",
    };
    const hash = contentHash(nextPayload);
    await db.query(
      `UPDATE research_entities
          SET current_revision = 2,
              summary = $2,
              payload = $3::jsonb,
              content_hash = $4,
              updated_at = now()
        WHERE id = $1::uuid`,
      [body.entityId, nextPayload.summary, JSON.stringify(nextPayload), hash],
    );
    await db.query(
      `INSERT INTO research_entity_revisions
         (entity_id, revision, payload, content_hash, created_by)
       VALUES ($1::uuid, 2, $2::jsonb, $3, 'system')`,
      [body.entityId, JSON.stringify(nextPayload), hash],
    );

    await asUser(db, userA, (rdb) => reconcileProjectionOnce(rdb, canvasId));

    const snap = await app.inject({
      method: "GET",
      url: `/api/canvases/${canvasId}`,
      headers,
    });
    const canvas = snap.json();
    assert.equal(canvas.nodes.length, 1);
    assert.equal(canvas.nodes[0].id, body.nodeId);
    assert.equal(canvas.nodes[0].data.summary, nextPayload.summary);
    assert.equal(canvas.nodes[0].data.entityRef.refRevision, 2);
    assert.equal(canvas.nodes[0].position.x, 40);
    assert.equal(canvas.nodes[0].position.y, 80);
    assert.ok(canvas.version > 1);

    const nodes = await db.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM canvas_nodes WHERE canvas_id = $1::uuid",
      [canvasId],
    );
    assert.equal(nodes.rows[0]?.n, "1");
    const layout = await db.query<{ x: number; y: number; width: number | null }>(
      "SELECT x, y, width FROM canvas_layout WHERE node_id = $1::uuid",
      [body.nodeId],
    );
    assert.equal(layout.rows[0]?.x, 40);
    assert.equal(layout.rows[0]?.y, 80);
    assert.equal(layout.rows[0]?.width, 260);
    const proj = await db.query<{ projector_version: number }>(
      "SELECT projector_version FROM canvas_projections WHERE node_id = $1::uuid",
      [body.nodeId],
    );
    assert.equal(Number(proj.rows[0]?.projector_version), 2);
  });
});
