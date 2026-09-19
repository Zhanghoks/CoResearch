import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SignJWT } from "jose";
import { parseCandidatePart, proposeCandidate } from "@coresearch/research";

import { buildApp } from "../app.js";
import { asUser, createUser, freshDb } from "../test/pgliteHarness.js";
import { createMemoryStreamBus } from "./streamBus.js";

import type {
  AcceptCandidateResult,
  AgentMessageList,
  CreatedRun,
  CreatedThread,
} from "@coresearch/shared";

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
  const streamBus = createMemoryStreamBus();
  const app = buildApp({
    auth: { secret, issuer },
    withRequestContext: (ctx, fn) => asUser(db, ctx.userId, fn),
    streamBus,
  });
  return { app, db, streamBus };
}

async function bearer(userId: string) {
  return { authorization: `Bearer ${await tokenFor(userId)}` };
}

describe("agent threads / runs / messages", () => {
  it("creates a thread and queues a run, messages stay empty until persist", async () => {
    const { app } = await harness();
    const headers = await bearer(userA);
    const project = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { title: "Agent loop" },
    });
    const { projectId } = project.json() as { projectId: string };

    const thread = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/threads`,
      headers,
    });
    assert.equal(thread.statusCode, 201);
    const { threadId } = thread.json() as CreatedThread;

    const run = await app.inject({
      method: "POST",
      url: `/api/threads/${threadId}/runs`,
      headers,
      payload: { prompt: "Propose a direction" },
    });
    assert.equal(run.statusCode, 201);
    const body = run.json() as CreatedRun;
    assert.equal(body.status, "queued");
    assert.ok(body.runId);

    const messages = await app.inject({
      method: "GET",
      url: `/api/threads/${threadId}/messages`,
      headers,
    });
    assert.equal(messages.statusCode, 200);
    const list = messages.json() as AgentMessageList;
    assert.equal(list.messages.length, 0);
  });

  it("hides another tenant's thread", async () => {
    const { app } = await harness();
    const headersA = await bearer(userA);
    const project = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers: headersA,
      payload: { title: "Private" },
    });
    const { projectId } = project.json() as { projectId: string };
    const thread = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/threads`,
      headers: headersA,
    });
    const { threadId } = thread.json() as CreatedThread;

    const peek = await app.inject({
      method: "GET",
      url: `/api/threads/${threadId}/messages`,
      headers: await bearer(userB),
    });
    assert.equal(peek.statusCode, 404);
  });

  it("proposeCandidate row accepts through the 06 path", async () => {
    const { app, db } = await harness();
    const headers = await bearer(userA);
    const project = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { title: "Accept from agent" },
    });
    const { projectId, canvasId } = project.json() as {
      projectId: string;
      canvasId: string;
    };
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
      payload: { prompt: "go" },
    });
    const { runId } = run.json() as CreatedRun;

    const proposed = await asUser(db, userA, (cx) =>
      proposeCandidate(cx, {
        threadId,
        runId,
        kind: "direction",
        payload: { title: "Agent direction", summary: "from propose_candidates" },
      }),
    );
    const part = await asUser(db, userA, async (cx) => {
      const row = await cx.query<{ id: string; payload: unknown }>(
        "SELECT id, payload FROM agent_messages WHERE id = $1::uuid",
        [proposed.candidateId],
      );
      return parseCandidatePart(row.rows[0]!.id, row.rows[0]!.payload);
    });
    assert.ok(part);
    assert.equal(part.candidateId, proposed.candidateId);

    const accepted = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/candidates/${proposed.candidateId}/accept`,
      headers,
      payload: { canvasId, placement: { position: { x: 10, y: 20 } } },
    });
    assert.equal(accepted.statusCode, 200);
    const result = accepted.json() as AcceptCandidateResult;
    assert.ok(result.entityId);
    assert.ok(result.nodeId);
  });

  it("stream bus events do not insert agent_messages", async () => {
    const { app, db, streamBus } = await harness();
    const headers = await bearer(userA);
    const project = await app.inject({
      method: "POST",
      url: "/api/projects",
      headers,
      payload: { title: "SSE" },
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
      payload: { prompt: "stream" },
    });
    const { runId } = run.json() as CreatedRun;

    const seen: string[] = [];
    const stop = streamBus.listen(runId, (event) => {
      seen.push(event.type);
    });
    streamBus.publish(runId, { type: "message.delta", payload: { text: "tok" } });
    stop();

    assert.deepEqual(seen, ["message.delta"]);
    const count = await asUser(db, userA, (cx) =>
      cx.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM agent_messages WHERE thread_id = $1::uuid",
        [threadId],
      ),
    );
    assert.equal(count.rows[0]!.n, 0);
  });
});
