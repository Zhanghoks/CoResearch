// DeepSeek is the local default (OpenAI-compatible, official Pi models.json).
// Latest flagship as of 2026-04-24: deepseek-v4-pro. Flash is opt-in via
// DEEPSEEK_MODEL. Legacy deepseek-chat / deepseek-reasoner were retired.

import type { CreateAgentSessionOptions } from "@earendil-works/pi-coding-agent";

type SessionModel = NonNullable<CreateAgentSessionOptions["model"]>;

function stubSessionModel(): SessionModel {
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

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-pro";

const DEEPSEEK_COMPAT = {
  requiresReasoningContentOnAssistantMessages: true,
  thinkingFormat: "deepseek" as const,
  supportsReasoningEffort: true,
  maxTokensField: "max_tokens" as const,
};

function deepseekModel(
  id: string,
  name: string,
  cost: SessionModel["cost"],
): SessionModel {
  return {
    id,
    name,
    api: "openai-completions",
    provider: "deepseek",
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? DEEPSEEK_BASE_URL,
    reasoning: true,
    input: ["text"],
    cost,
    contextWindow: 1_000_000,
    maxTokens: 384_000,
    compat: DEEPSEEK_COMPAT,
  };
}

export const DEEPSEEK_MODELS: Record<string, SessionModel> = {
  "deepseek-v4-pro": deepseekModel("deepseek-v4-pro", "DeepSeek V4 Pro", {
    input: 1.74,
    output: 3.48,
    cacheRead: 0.145,
    cacheWrite: 0,
  }),
  "deepseek-v4-flash": deepseekModel("deepseek-v4-flash", "DeepSeek V4 Flash", {
    input: 0.14,
    output: 0.28,
    cacheRead: 0.028,
    cacheWrite: 0,
  }),
  "deepseek-flash": deepseekModel("deepseek-flash", "DeepSeek Flash", {
    input: 0.14,
    output: 0.28,
    cacheRead: 0.028,
    cacheWrite: 0,
  }),
};

export function deepseekModelsFile(): {
  providers: {
    deepseek: {
      baseUrl: string;
      api: "openai-completions";
      apiKey: string;
      models: Array<Record<string, unknown>>;
    };
  };
} {
  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? DEEPSEEK_BASE_URL;
  return {
    providers: {
      deepseek: {
        baseUrl,
        api: "openai-completions",
        apiKey: "$DEEPSEEK_API_KEY",
        models: Object.values(DEEPSEEK_MODELS).map((model) => ({
          id: model.id,
          name: model.name,
          contextWindow: model.contextWindow,
          maxTokens: model.maxTokens,
          input: model.input,
          reasoning: model.reasoning,
          cost: model.cost,
          compat: model.compat,
        })),
      },
    },
  };
}

/** Resolve the session model from env. No key → stub (factory tests / CI). */
export function resolveSessionModel(): SessionModel {
  if (!process.env.DEEPSEEK_API_KEY?.trim()) {
    return stubSessionModel();
  }
  const requested = process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL;
  const model = DEEPSEEK_MODELS[requested];
  if (!model) {
    throw new Error(
      `Unknown DEEPSEEK_MODEL "${requested}". Use ${Object.keys(DEEPSEEK_MODELS).join(", ")}.`,
    );
  }
  return {
    ...model,
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? model.baseUrl,
  };
}
