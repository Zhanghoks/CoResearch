// Agent Worker entry point — claim/lease/heartbeat/cancel loop.
// Full spec: docs/spec/05-agent-runtime-worker.md §3 (this file is the
// `workerLoop`/`processRun` sketch from that doc, not yet wired to a real
// Postgres connection or createCoResearchAgentSession()).
//
// Build order (docs/spec/03-canvas-engine-port.md §5 step 6-7, this is the
// last piece): only start this once packages/research's Candidate/Proposal
// functions and packages/engine's command set are real, since the six
// tools (docs/spec/05 §4) are thin wrappers over packages/research.

async function workerLoop(_workerId: string): Promise<never> {
  throw new Error("not implemented — see docs/spec/05-agent-runtime-worker.md §3");
}

const workerId = process.env.WORKER_ID ?? crypto.randomUUID();
workerLoop(workerId).catch((err) => {
  console.error(err);
  process.exit(1);
});
