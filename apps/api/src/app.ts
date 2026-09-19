// CoResearch API application factory.
//
// The Postgres context runner is injected rather than imported so tests
// can drive the real routes, the real policies and real JWTs against an
// in-memory Postgres. Production passes `withRequestContext` (a pg Pool);
// tests pass a PGlite-backed equivalent. Nothing else about the request
// path differs between the two.

import Fastify, { type FastifyInstance } from "fastify";

import { verifyAccessToken, type AuthConfig } from "./auth/verifyAccessToken.js";
import { createProject } from "./projects/createProject.js";
import { listProjects } from "./projects/listProjects.js";
import { executeOnCanvas } from "./canvas/executeOnCanvas.js";
import { readCanvas } from "./canvas/readCanvas.js";
import { readDeltas } from "./canvas/readDeltas.js";
import {
  AcceptNotFoundError,
  acceptCandidate,
} from "./research/acceptCandidate.js";
import {
  ProjectNotFoundError,
  insertFixtureCandidate,
  listCandidates,
} from "./research/candidates.js";

import type { AcceptCandidateBody, CanvasCommand } from "@coresearch/shared";

import type { RequestContext, RequestDb } from "./db/index.js";

export type RunInRequestContext = <T>(
  ctx: RequestContext,
  fn: (db: RequestDb) => Promise<T>,
) => Promise<T>;

export type AppDeps = {
  auth: AuthConfig;
  withRequestContext: RunInRequestContext;
};

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

export function buildApp(deps: AppDeps, opts: { logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? false });

  app.get("/healthz", async () => ({ ok: true }));

  app.register(async (api) => {
    // Every route in this scope is authenticated. Registering the hook on
    // the plugin (not globally) keeps /healthz open without each handler
    // having to remember to opt in.
    api.addHook("preHandler", async (request, reply) => {
      const header = request.headers.authorization;
      const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
      if (!token) {
        return reply.code(401).send({ error: "missing bearer token" });
      }
      try {
        const caller = await verifyAccessToken(token, deps.auth);
        request.userId = caller.userId;
      } catch {
        // Never echo the verification failure: it distinguishes expired
        // from forged from wrong-project for an unauthenticated caller.
        return reply.code(401).send({ error: "invalid token" });
      }
    });

    api.post("/api/projects", async (request, reply) => {
      const body = (request.body ?? {}) as { title?: unknown };
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) {
        return reply.code(400).send({ error: "title is required" });
      }

      const created = await deps.withRequestContext(
        { userId: request.userId },
        (db) => createProject(db, { userId: request.userId, title }),
      );
      return reply.code(201).send(created);
    });

    api.get("/api/projects", async (request) => {
      return deps.withRequestContext({ userId: request.userId }, (db) =>
        listProjects(db),
      );
    });

    api.get("/api/projects/:projectId/candidates", async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const candidates = await deps.withRequestContext(
        { userId: request.userId },
        (db) => listCandidates(db, projectId),
      );
      return { candidates };
    });

    api.post("/api/projects/:projectId/candidates/fixture", async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      try {
        const candidate = await deps.withRequestContext(
          { userId: request.userId },
          (db) => insertFixtureCandidate(db, projectId),
        );
        return reply.code(201).send(candidate);
      } catch (err) {
        if (err instanceof ProjectNotFoundError) {
          return reply.code(404).send({ error: "project not found" });
        }
        throw err;
      }
    });

    api.post(
      "/api/projects/:projectId/candidates/:candidateId/accept",
      async (request, reply) => {
        const { projectId, candidateId } = request.params as {
          projectId: string;
          candidateId: string;
        };
        const body = (request.body ?? {}) as Partial<AcceptCandidateBody>;
        const canvasId = body.canvasId;
        const position = body.placement?.position;
        if (
          typeof canvasId !== "string" ||
          typeof position?.x !== "number" ||
          typeof position?.y !== "number"
        ) {
          return reply.code(400).send({
            error: "canvasId and placement.position are required",
          });
        }
        try {
          return await deps.withRequestContext(
            { userId: request.userId },
            (db) =>
              acceptCandidate(db, {
                projectId,
                candidateId,
                canvasId,
                placement: {
                  parentNodeId: body.placement?.parentNodeId,
                  position,
                },
              }),
          );
        } catch (err) {
          if (err instanceof AcceptNotFoundError) {
            return reply.code(404).send({ error: err.message });
          }
          throw err;
        }
      },
    );

    api.get("/api/canvases/:canvasId", async (request, reply) => {
      const { canvasId } = request.params as { canvasId: string };
      const canvas = await deps.withRequestContext(
        { userId: request.userId },
        (db) => readCanvas(db, canvasId),
      );
      if (!canvas) {
        // 404 rather than 403: a project we cannot see must not be
        // distinguishable from one that does not exist.
        return reply.code(404).send({ error: "canvas not found" });
      }
      return canvas;
    });

    api.post("/api/canvases/:canvasId/execute", async (request, reply) => {
      const { canvasId } = request.params as { canvasId: string };
      const body = (request.body ?? {}) as { commands?: unknown };
      if (!Array.isArray(body.commands)) {
        return reply.code(400).send({ error: "commands array is required" });
      }
      const result = await deps.withRequestContext(
        { userId: request.userId },
        (db) =>
          executeOnCanvas(db, canvasId, body.commands as CanvasCommand[]),
      );
      if (!result) {
        return reply.code(404).send({ error: "canvas not found" });
      }
      return result;
    });

    api.get("/api/canvases/:canvasId/deltas", async (request, reply) => {
      const { canvasId } = request.params as { canvasId: string };
      const after = Number(
        (request.query as { afterVersion?: string }).afterVersion ?? "0",
      );
      if (!Number.isFinite(after) || after < 0) {
        return reply.code(400).send({ error: "afterVersion must be >= 0" });
      }
      const log = await deps.withRequestContext(
        { userId: request.userId },
        (db) => readDeltas(db, canvasId, after),
      );
      if (!log) {
        return reply.code(404).send({ error: "canvas not found" });
      }
      return log;
    });
  });

  return app;
}
