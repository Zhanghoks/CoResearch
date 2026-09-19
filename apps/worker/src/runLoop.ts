// Agent Worker entry: claim queued / lease-expired runs and process them.

import pg from "pg";

import { claimNextRun } from "@coresearch/research";

import { runEventChannel } from "./adaptPiEvent.js";
import { processRun } from "./processRun.js";

import type { SqlQuery } from "@coresearch/research";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function servicePool(): pg.Pool {
  const connectionString = process.env.CORESEARCH_SERVICE_DATABASE_URL;
  if (!connectionString) {
    throw new Error("CORESEARCH_SERVICE_DATABASE_URL is not set");
  }
  return new pg.Pool({ connectionString });
}

function asSql(client: pg.PoolClient): SqlQuery {
  return { query: client.query.bind(client) as SqlQuery["query"] };
}

async function publishNotify(
  client: pg.PoolClient,
  runId: string,
  event: { type: string; payload: unknown },
): Promise<void> {
  const channel = runEventChannel(runId);
  await client.query("SELECT pg_notify($1, $2)", [channel, JSON.stringify(event)]);
}

export async function workerLoop(workerId: string): Promise<never> {
  const pool = servicePool();
  while (true) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const run = await claimNextRun(asSql(client), workerId);
      await client.query("COMMIT");
      if (!run) {
        await sleep(1000);
        continue;
      }
      await processRun(asSql(client), run, {
        workerId,
        publish: (runId, event) => publishNotify(client, runId, event),
      });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore
      }
      console.error(err);
      await sleep(1000);
    } finally {
      client.release();
    }
  }
}

if (process.argv[1]?.includes("runLoop")) {
  const workerId = process.env.WORKER_ID ?? crypto.randomUUID();
  workerLoop(workerId).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
