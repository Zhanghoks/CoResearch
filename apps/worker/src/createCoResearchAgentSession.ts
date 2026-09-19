// The only production file allowed to import createAgentSession (ADR 0006).

import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createAgentSession,
  SessionManager,
  SettingsManager,
  type CreateAgentSessionOptions,
  type FileEntry,
} from "@earendil-works/pi-coding-agent";

import {
  RESEARCH_TOOL_ALLOWLIST,
  assertExposedToolsMatch,
} from "./allowlist.js";
import { coresearchResourceLoader } from "./coresearchResourceLoader.js";
import { deepseekModelsFile } from "./resolveModel.js";
import {
  createCoresearchTools,
  type ResearchToolHost,
} from "./tools/index.js";

export type { ResearchToolHost };
export { RESEARCH_TOOL_ALLOWLIST } from "./allowlist.js";

export type SessionModel = NonNullable<CreateAgentSessionOptions["model"]>;

const stubHost: ResearchToolHost = {
  proposeCandidate: async () => {
    throw new Error("proposeCandidate host is not configured");
  },
};

export async function createCoResearchAgentSession(opts: {
  model: SessionModel;
  projectId: string;
  threadId: string;
  entries?: FileEntry[];
  host?: ResearchToolHost;
}) {
  const isolated = join(tmpdir(), "coresearch-pi", opts.projectId);
  mkdirSync(isolated, { recursive: true });
  if (opts.model.provider === "deepseek") {
    writeFileSync(
      join(isolated, "models.json"),
      JSON.stringify(deepseekModelsFile(), null, 2),
    );
  }

  const { session } = await createAgentSession({
    cwd: isolated,
    agentDir: isolated,
    model: opts.model,
    thinkingLevel: opts.model.provider === "deepseek" ? "high" : undefined,
    resourceLoader: coresearchResourceLoader,
    sessionManager: SessionManager.inMemory(
      opts.threadId,
      { id: opts.threadId },
      opts.entries,
    ),
    settingsManager: SettingsManager.create(isolated, isolated),
    tools: [...RESEARCH_TOOL_ALLOWLIST],
    customTools: createCoresearchTools(opts.host ?? stubHost),
  });
  assertExposedToolsMatch(session, RESEARCH_TOOL_ALLOWLIST);
  return session;
}

/** Minimal model so the factory can boot without a provider key. */
export function stubSessionModel(): SessionModel {
  return {
    id: "coresearch-stub",
    name: "CoResearch stub",
    api: "openai-completions",
    provider: "openai",
    baseUrl: "http://127.0.0.1:9",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 8192,
    maxTokens: 256,
  };
}
