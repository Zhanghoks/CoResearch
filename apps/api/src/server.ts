// CoResearch API entry point.
//
// Route registration follows docs/spec/02-api-contract.md. Every handler
// that touches Postgres as `coresearch_app` must go through
// `withRequestContext()` (src/db/withRequestContext.ts, not written yet) —
// see docs/spec/01-database-schema.md §0 and ADR 0013: `SET LOCAL
// app.current_user_id` must be scoped to the same transaction, never a bare
// pooled-connection `SET`.

import Fastify from "fastify";

const app = Fastify({ logger: true });

app.get("/healthz", async () => ({ ok: true }));

// Route modules to add as they're implemented (docs/spec/02-api-contract.md):
//   /api/projects            — §1
//   /api/projects/:id/research, /candidates/:id/accept, /proposals  — §2
//   /api/canvases/:id, /execute, /deltas                            — §3
//   /api/threads/:id, /runs/:id/stream, /runs/:id/cancel            — §4

const port = Number(process.env.PORT ?? 8787);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
