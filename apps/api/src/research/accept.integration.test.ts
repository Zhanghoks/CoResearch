import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SignJWT } from "jose";

import { buildApp } from "../app.js";
import { asUser, createUser, freshDb } from "../test/pgliteHarness.js";
import { acceptCandidate } from "./acceptCandidate.js";

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

async function seed(app: ReturnType<typeof buildApp>) {
  const created = await app.inject({
    method: "POST",
    url: "/api/projects",
    headers: await bearer(userA),
    payload: { title: "Research" },
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
  return { projectId, canvasId, candidate };
}

describe("POST /api/projects/:id/candidates/:id/accept", () => {
  it("materializes entity + crEntity + projection + delta in one transaction", async () => {
    const { app, db } = await harness();
    const { projectId, canvasId, candidate } = await seed(app);
    const headers = await bearer(userA);

    const accepted = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/candidates/${candidate.candidateId}/accept`,
      headers,
      payload: {
        canvasId,
        placement: { position: { x: 40, y: 80 } },
      },
    });
    assert.equal(accepted.statusCode, 200);
    const body = accepted.json() as AcceptCandidateResult;
    assert.equal(body.alreadyMaterialized, false);
    assert.equal(body.version, 1);
    assert.equal(body.fromVersion, 0);
    assert.match(body.entityId, /^[0-9a-f-]{36}$/i);
    assert.match(body.nodeId, /^[0-9a-f-]{36}$/i);
    const insert = (body.deltas as Array<{ type: string; node?: { data?: Record<string, unknown> } }>).find(
      (d) => d.type === "INSERT_NODE",
    );
    assert.ok(insert);
    assert.equal(insert?.node?.data?.entityKind, "direction");
    assert.equal("selected" in (insert?.node ?? {}), false);

    const entities = await db.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM research_entities",
    );
    assert.equal(entities.rows[0]?.n, "1");
    const revisions = await db.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM research_entity_revisions",
    );
    assert.equal(revisions.rows[0]?.n, "1");
    const projections = await db.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM canvas_projections",
    );
    assert.equal(projections.rows[0]?.n, "1");
    const native = await db.query<{ native_data: Record<string, unknown> }>(
      "SELECT native_data FROM canvas_nodes WHERE id = $1::uuid",
      [body.nodeId],
    );
    assert.equal(native.rows[0]?.native_data.entityKind, undefined);
    assert.equal(native.rows[0]?.native_data.status, undefined);

    const snap = await app.inject({
      method: "GET",
      url: `/api/canvases/${canvasId}`,
      headers,
    });
    assert.equal(snap.statusCode, 200);
    const canvas = snap.json();
    assert.equal(canvas.version, 1);
    assert.equal(canvas.nodes.length, 1);
    assert.equal(canvas.nodes[0].type, "crEntity");
    assert.equal(canvas.nodes[0].position.x, 40);
    assert.equal(canvas.nodes[0].data.entityKind, "direction");
    assert.equal(canvas.nodes[0].data.title, "Attribution under uncertainty");
    assert.equal(canvas.nodes[0].data.entityRef.refId, body.entityId);

    const listed = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/candidates`,
      headers,
    });
    assert.equal(listed.json().candidates.length, 1);
    assert.equal(listed.json().candidates[0].candidateId, candidate.candidateId);
  });

  it("is idempotent on the unique source_candidate_id", async () => {
    const { app, db } = await harness();
    const { projectId, canvasId, candidate } = await seed(app);
    const headers = await bearer(userA);
    const payload = {
      canvasId,
      placement: { position: { x: 1, y: 2 } },
    };
    const first = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/candidates/${candidate.candidateId}/accept`,
      headers,
      payload,
    });
    const second = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/candidates/${candidate.candidateId}/accept`,
      headers,
      payload: {
        canvasId,
        placement: { position: { x: 99, y: 99 } },
      },
    });
    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    const a = first.json() as AcceptCandidateResult;
    const b = second.json() as AcceptCandidateResult;
    assert.equal(b.alreadyMaterialized, true);
    assert.equal(b.entityId, a.entityId);
    assert.equal(b.nodeId, a.nodeId);
    assert.equal(b.version, 1);
    assert.equal(b.deltas.length, 0);

    const entities = await db.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM research_entities",
    );
    assert.equal(entities.rows[0]?.n, "1");
    const nodes = await db.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM canvas_nodes",
    );
    assert.equal(nodes.rows[0]?.n, "1");
  });

  it("rolls back the entity when the transaction fails before projection", async () => {
    const { app, db } = await harness();
    const { projectId, canvasId, candidate } = await seed(app);

    await assert.rejects(
      () =>
        asUser(db, userA, (rdb) =>
          acceptCandidate(rdb, {
            projectId,
            candidateId: candidate.candidateId,
            canvasId,
            placement: { position: { x: 0, y: 0 } },
            failBefore: "projection",
          }),
        ),
      /fail before projection/,
    );

    const entities = await db.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM research_entities",
    );
    assert.equal(entities.rows[0]?.n, "0");
    const nodes = await db.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM canvas_nodes",
    );
    assert.equal(nodes.rows[0]?.n, "0");
    const projections = await db.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM canvas_projections",
    );
    assert.equal(projections.rows[0]?.n, "0");
    const versions = await db.query<{ version: string | number }>(
      "SELECT version FROM canvases WHERE id = $1::uuid",
      [canvasId],
    );
    assert.equal(Number(versions.rows[0]?.version), 0);
    const deltas = await db.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM canvas_deltas",
    );
    assert.equal(deltas.rows[0]?.n, "0");
  });

  it("returns 404 for another user's project and for a missing candidate", async () => {
    const { app } = await harness();
    const { projectId, canvasId, candidate } = await seed(app);

    const cross = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/candidates/${candidate.candidateId}/accept`,
      headers: await bearer(userB),
      payload: { canvasId, placement: { position: { x: 0, y: 0 } } },
    });
    assert.equal(cross.statusCode, 404);

    const missing = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/candidates/00000000-0000-0000-0000-000000000099/accept`,
      headers: await bearer(userA),
      payload: { canvasId, placement: { position: { x: 0, y: 0 } } },
    });
    assert.equal(missing.statusCode, 404);
  });
});
