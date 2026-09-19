import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SignJWT } from "jose";
import { proposeRevision } from "@coresearch/research";

import { buildApp } from "../app.js";
import { asUser, createUser, freshDb } from "../test/pgliteHarness.js";

import type { AcceptCandidateResult, AcceptProposalResult, CandidatePart, ProposalList, ProposalRecord } from "@coresearch/shared";

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

async function acceptedEntity(app: ReturnType<typeof buildApp>) {
  const headers = await bearer(userA);
  const created = await app.inject({
    method: "POST",
    url: "/api/projects",
    headers,
    payload: { title: "Track B" },
  });
  const { projectId, canvasId } = created.json() as {
    projectId: string;
    canvasId: string;
  };
  const fixture = await app.inject({
    method: "POST",
    url: `/api/projects/${projectId}/candidates/fixture`,
    headers,
  });
  const candidate = fixture.json() as CandidatePart;
  const accepted = await app.inject({
    method: "POST",
    url: `/api/projects/${projectId}/candidates/${candidate.candidateId}/accept`,
    headers,
    payload: { canvasId, placement: { position: { x: 40, y: 80 } } },
  });
  const body = accepted.json() as AcceptCandidateResult;
  return { headers, projectId, canvasId, body };
}

describe("Track B proposals (ticket 09)", () => {
  it("propose_revision inserts a pending row and lists it off-canvas", async () => {
    const { app, db } = await harness();
    const { headers, projectId, body } = await acceptedEntity(app);

    const proposed = await asUser(db, userA, (rdb) =>
      proposeRevision(rdb, {
        projectId,
        entityId: body.entityId,
        baseStateRevision: 1,
        kind: "revision",
        changes: [
          {
            target: "summary",
            beforeStatementId: null,
            after: { text: "revised after a literature pass" },
          },
        ],
        rationale: "tighten the claim",
      }),
    );

    const listed = await app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/proposals?status=pending`,
      headers,
    });
    assert.equal(listed.statusCode, 200);
    const payload = listed.json() as ProposalList;
    assert.equal(payload.proposals.length, 1);
    assert.equal(payload.proposals[0]?.id, proposed.proposalId);
    assert.equal(payload.proposals[0]?.status, "pending");
    assert.equal(payload.proposals[0]?.entityId, body.entityId);
  });

  it("accept applies the diff, bumps revision, and refreshes the same node", async () => {
    const { app, db } = await harness();
    const { headers, projectId, canvasId, body } = await acceptedEntity(app);

    const proposed = await asUser(db, userA, (rdb) =>
      proposeRevision(rdb, {
        projectId,
        entityId: body.entityId,
        baseStateRevision: 1,
        kind: "revision",
        changes: [
          {
            target: "summary",
            beforeStatementId: null,
            after: { text: "revised after a literature pass" },
          },
          {
            target: "title",
            beforeStatementId: null,
            after: { text: "Attribution under uncertainty" },
          },
        ],
      }),
    );

    const accepted = await app.inject({
      method: "POST",
      url: `/api/proposals/${proposed.proposalId}/accept`,
      headers,
    });
    assert.equal(accepted.statusCode, 200);
    const result = accepted.json() as AcceptProposalResult;
    assert.equal(result.entityId, body.entityId);
    assert.equal(result.revision, 2);
    assert.equal(result.nodeId, body.nodeId);

    const entity = await db.query<{ current_revision: number; summary: string }>(
      "SELECT current_revision, summary FROM research_entities WHERE id = $1::uuid",
      [body.entityId],
    );
    assert.equal(Number(entity.rows[0]?.current_revision), 2);
    assert.equal(entity.rows[0]?.summary, "revised after a literature pass");

    const revisions = await db.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM research_entity_revisions WHERE entity_id = $1::uuid",
      [body.entityId],
    );
    assert.equal(revisions.rows[0]?.n, "2");

    const nodes = await db.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM canvas_nodes WHERE canvas_id = $1::uuid",
      [canvasId],
    );
    assert.equal(nodes.rows[0]?.n, "1");
    const layout = await db.query<{ x: number; y: number }>(
      "SELECT x, y FROM canvas_layout WHERE node_id = $1::uuid",
      [body.nodeId],
    );
    assert.equal(layout.rows[0]?.x, 40);
    assert.equal(layout.rows[0]?.y, 80);

    const snap = await app.inject({
      method: "GET",
      url: `/api/canvases/${canvasId}`,
      headers,
    });
    const canvas = snap.json();
    assert.equal(canvas.nodes.length, 1);
    assert.equal(canvas.nodes[0].id, body.nodeId);
    assert.equal(canvas.nodes[0].data.summary, "revised after a literature pass");
    assert.equal(canvas.nodes[0].data.entityRef.refRevision, 2);
  });

  it("rejects accept when baseStateRevision does not match", async () => {
    const { app, db } = await harness();
    const { headers, projectId, body } = await acceptedEntity(app);

    const proposed = await asUser(db, userA, (rdb) =>
      proposeRevision(rdb, {
        projectId,
        entityId: body.entityId,
        baseStateRevision: 0,
        kind: "revision",
        changes: [{ target: "summary", beforeStatementId: null, after: { text: "stale" } }],
      }),
    );

    const accepted = await app.inject({
      method: "POST",
      url: `/api/proposals/${proposed.proposalId}/accept`,
      headers,
    });
    assert.equal(accepted.statusCode, 409);

    const entity = await db.query<{ current_revision: number }>(
      "SELECT current_revision FROM research_entities WHERE id = $1::uuid",
      [body.entityId],
    );
    assert.equal(Number(entity.rows[0]?.current_revision), 1);
    const proposal = await db.query<{ status: string }>(
      "SELECT status FROM proposals WHERE id = $1::uuid",
      [proposed.proposalId],
    );
    assert.equal(proposal.rows[0]?.status, "pending");
  });

  it("reject archives the proposal and leaves the entity untouched", async () => {
    const { app, db } = await harness();
    const { headers, projectId, canvasId, body } = await acceptedEntity(app);

    const proposed = await asUser(db, userA, (rdb) =>
      proposeRevision(rdb, {
        projectId,
        entityId: body.entityId,
        baseStateRevision: 1,
        kind: "revision",
        changes: [{ target: "summary", beforeStatementId: null, after: { text: "nope" } }],
      }),
    );

    const rejected = await app.inject({
      method: "POST",
      url: `/api/proposals/${proposed.proposalId}/reject`,
      headers,
    });
    assert.equal(rejected.statusCode, 200);
    const record = rejected.json() as ProposalRecord;
    assert.equal(record.status, "rejected");

    const entity = await db.query<{ current_revision: number; summary: string | null }>(
      "SELECT current_revision, summary FROM research_entities WHERE id = $1::uuid",
      [body.entityId],
    );
    assert.equal(Number(entity.rows[0]?.current_revision), 1);
    assert.notEqual(entity.rows[0]?.summary, "nope");

    const nodes = await db.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM canvas_nodes WHERE canvas_id = $1::uuid",
      [canvasId],
    );
    assert.equal(nodes.rows[0]?.n, "1");
  });
});
