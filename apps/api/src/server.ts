// CoResearch API entry point.
//
// Route registration follows docs/spec/02-api-contract.md. Every handler
// that touches Postgres as `coresearch_app` goes through
// `withRequestContext()` — see ADR 0013: `SET LOCAL app.current_user_id`
// must be scoped to the same transaction, never a bare pooled `SET`.
//
// Still to add as their tickets land:
//   /api/projects/:id/research, /candidates/:id/accept, /proposals  — §2
//   /api/canvases/:id/execute, /deltas                              — §3
//   /api/threads/:id, /runs/:id/stream, /runs/:id/cancel            — §4

import cors from "@fastify/cors";

import { buildApp } from "./app.js";
import { withRequestContext } from "./db/index.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// Supabase signs project JWTs with this (Dashboard → Settings → API →
// JWT Secret). Verified on every request; see auth/verifyAccessToken.ts.
const jwtSecret = new TextEncoder().encode(required("SUPABASE_JWT_SECRET"));
const issuer = `${required("SUPABASE_URL").replace(/\/+$/, "")}/auth/v1`;

const app = buildApp(
  { auth: { secret: jwtSecret, issuer }, withRequestContext },
  { logger: true },
);

// The SPA is served from a different origin in dev (Vite on 5173).
await app.register(cors, {
  origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  credentials: true,
});

const port = Number(process.env.PORT ?? 8787);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
