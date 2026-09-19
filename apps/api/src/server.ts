// CoResearch API entry point.
//
// Route registration follows docs/spec/02-api-contract.md. Every handler
// that touches Postgres as `coresearch_app` goes through
// `withRequestContext()` — see ADR 0013: `SET LOCAL app.current_user_id`
// must be scoped to the same transaction, never a bare pooled `SET`.
//
// Routes live in app.ts (docs/spec/02).

import cors from "@fastify/cors";

import { createPgStreamBus } from "./db/pgStreamBus.js";
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

const listenUrl =
  process.env.CORESEARCH_APP_DATABASE_URL ?? process.env.DATABASE_URL;
const streamBus = listenUrl ? createPgStreamBus(listenUrl) : undefined;

const app = buildApp(
  { auth: { secret: jwtSecret, issuer }, withRequestContext, streamBus },
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
