// Custom ResourceLoader: no filesystem discovery (docs/spec/05 §2).
// The SDK interface is sync and wider than the spec sketch; unused
// surfaces stay empty. createExtensionRuntime() is the stub runtime
// the session constructor requires.

import {
  createExtensionRuntime,
  type ResourceLoader,
} from "@earendil-works/pi-coding-agent";

export const CORESEARCH_SYSTEM_PROMPT = [
  "You are the CoResearch research agent.",
  "You may only use the registered research tools.",
  "Never run shell commands or edit files.",
  "Propose new research entities with propose_candidates.",
  "Do not accept candidates or write the canvas — the user does that.",
].join(" ");

const emptyExtensions = {
  extensions: [],
  errors: [],
  runtime: createExtensionRuntime(),
};

export const coresearchResourceLoader: ResourceLoader = {
  getExtensions: () => emptyExtensions,
  getSkills: () => ({ skills: [], diagnostics: [] }),
  getPrompts: () => ({ prompts: [], diagnostics: [] }),
  getThemes: () => ({ themes: [], diagnostics: [] }),
  getAgentsFiles: () => ({ agentsFiles: [] }),
  getSystemPrompt: () => CORESEARCH_SYSTEM_PROMPT,
  getSystemPromptSource: () => undefined,
  getAppendSystemPrompt: () => [],
  getAppendSystemPromptSources: () => [],
  extendResources: () => {},
  reload: async () => {},
};
