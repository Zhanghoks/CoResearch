import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCandidatePart } from "@coresearch/research";
import { createUuid } from "@coresearch/shared";

import { processRun } from "./processRun.js";

import type { SqlQuery } from "@coresearch/research";

type Row = { id: string; thread_id?: string; payload?: unknown; parent_id?: string | null; entry_type?: string };

function mockDb() {
  const messages: Row[] = [];
  const runs: Array<{ id: string; status: string }> = [];
  const db: SqlQuery = {
    query: async (sql, params = []) => {
      if (sql.includes("SELECT payload FROM agent_messages")) {
        return { rows: messages.map((m) => ({ payload: m.payload })) };
      }
      if (sql.includes("SELECT id, payload FROM agent_messages")) {
        return { rows: messages.map((m) => ({ id: m.id, payload: m.payload })) };
      }
      if (sql.includes("INSERT INTO agent_messages")) {
        const id = String(params[0]);
        const payload =
          typeof params[params.length - 1] === "string"
            ? JSON.parse(params[params.length - 1] as string)
            : params[params.length - 1];
        messages.push({
          id,
          thread_id: String(params[1]),
          payload,
          parent_id: params.length > 4 ? (params[2] as string | null) : null,
          entry_type: params.length > 4 ? String(params[3]) : "message",
        });
        return { rows: [] };
      }
      if (sql.includes("UPDATE agent_runs")) {
        runs.push({ id: String(params[0]), status: String(params[1]) });
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
  return { db, messages, runs };
}

describe("processRun persist vs stream", () => {
  it("publishes message.delta without inserting until persist", async () => {
    const { db, messages, runs } = mockDb();
    const published: Array<{ type: string }> = [];
    const threadId = createUuid();
    const runId = createUuid();
    const projectId = createUuid();
    const userEntry = {
      type: "message",
      id: createUuid(),
      parentId: null,
      timestamp: new Date().toISOString(),
      message: { role: "user", content: [{ type: "text", text: "hi" }] },
    };
    const assistantEntry = {
      type: "message",
      id: createUuid(),
      parentId: userEntry.id,
      timestamp: new Date().toISOString(),
      message: { role: "assistant", content: [{ type: "text", text: "ok" }] },
    };

    let listener: ((event: { type: string; [k: string]: unknown }) => void) | undefined;
    const session = {
      subscribe(fn: (event: { type: string; [k: string]: unknown }) => void) {
        listener = fn;
        return () => {};
      },
      abort() {},
      async prompt() {
        listener?.({
          type: "message_update",
          assistantMessageEvent: { type: "text_delta", delta: "ok" },
        });
        assert.equal(messages.length, 0, "delta must not persist");
        listener?.({ type: "message_end" });
      },
      sessionManager: {
        getEntries: () => [userEntry, assistantEntry],
      },
      dispose() {},
    };

    await processRun(
      db,
      {
        id: runId,
        threadId,
        projectId,
        prompt: "hi",
        cancelRequested: false,
        leaseOwner: "test-worker",
      },
      {
        publish: async (_id, event) => {
          published.push(event);
        },
        createSession: async () => session as never,
        heartbeatMs: 60_000,
        cancelPollMs: 60_000,
        host: {
          proposeCandidate: async () => ({ candidateId: createUuid() }),
        },
      },
    );

    assert.ok(published.some((e) => e.type === "message.delta"));
    assert.equal(messages.length, 2);
    assert.equal(messages[0]?.payload && typeof messages[0].payload === "object", true);
    const payload = messages[0]!.payload as { type?: string; id?: string };
    assert.equal(payload.type, "message");
    assert.ok(payload.id);
    assert.equal(runs.at(-1)?.status, "completed");
  });

  it("propose_candidates host writes a parseable CandidatePart", async () => {
    const { db, messages } = mockDb();
    const threadId = createUuid();
    const runId = createUuid();
    let captured: string | undefined;
    const session = {
      subscribe() {
        return () => {};
      },
      abort() {},
      async prompt() {},
      sessionManager: { getEntries: () => [] },
      dispose() {},
    };

    await processRun(
      db,
      {
        id: runId,
        threadId,
        projectId: createUuid(),
        prompt: "propose",
        cancelRequested: false,
        leaseOwner: "test-worker",
      },
      {
        publish: async () => {},
        heartbeatMs: 60_000,
        cancelPollMs: 60_000,
        createSession: async (opts) => {
          const result = await opts.host!.proposeCandidate({
            kind: "direction",
            payload: { title: "From the agent", summary: "real produce path" },
          });
          captured = result.candidateId;
          return session as never;
        },
      },
    );

    assert.ok(captured);
    const row = messages.find((m) => m.id === captured);
    assert.ok(row);
    const part = parseCandidatePart(row.id, row.payload);
    assert.ok(part);
    assert.equal(part.candidateId, captured);
    assert.equal(part.kind, "direction");
  });

  it("marks cancelled without prompting when cancel_requested is already set", async () => {
    const { db, runs } = mockDb();
    let prompted = false;
    await processRun(
      db,
      {
        id: createUuid(),
        threadId: createUuid(),
        projectId: createUuid(),
        prompt: "hi",
        cancelRequested: true,
        leaseOwner: "test-worker",
      },
      {
        publish: async () => {},
        createSession: async () => {
          prompted = true;
          return {
            subscribe() {
              return () => {};
            },
            abort() {},
            async prompt() {
              prompted = true;
            },
            sessionManager: { getEntries: () => [] },
            dispose() {},
          } as never;
        },
      },
    );
    assert.equal(prompted, false);
    assert.equal(runs.at(-1)?.status, "cancelled");
  });

  it("calls session.abort when cancel is requested mid-run", async () => {
    const { db, runs } = mockDb();
    const runId = createUuid();
    let abortCalls = 0;
    let cancelNow = false;
    const originalQuery = db.query;
    db.query = async (sql, params = []) => {
      if (sql.includes("SELECT cancel_requested")) {
        return { rows: [{ cancel_requested: cancelNow }] };
      }
      return originalQuery(sql, params);
    };

    const session = {
      subscribe() {
        return () => {};
      },
      abort() {
        abortCalls += 1;
      },
      async prompt() {
        cancelNow = true;
        await new Promise((resolve) => setTimeout(resolve, 30));
      },
      sessionManager: { getEntries: () => [] },
      dispose() {},
    };

    await processRun(
      db,
      {
        id: runId,
        threadId: createUuid(),
        projectId: createUuid(),
        prompt: "hi",
        cancelRequested: false,
        leaseOwner: "test-worker",
      },
      {
        publish: async () => {},
        createSession: async () => session as never,
        heartbeatMs: 60_000,
        cancelPollMs: 10,
      },
    );

    assert.ok(abortCalls >= 1);
    assert.equal(runs.at(-1)?.status, "cancelled");
  });
});
