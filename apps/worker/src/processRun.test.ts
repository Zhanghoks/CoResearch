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
      },
      {
        publish: async (_id, event) => {
          published.push(event);
        },
        createSession: async () => session as never,
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
      },
      {
        publish: async () => {},
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
});
