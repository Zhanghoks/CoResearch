import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  RESEARCH_TOOL_ALLOWLIST,
  createCoResearchAgentSession,
  stubSessionModel,
} from "./createCoResearchAgentSession.js";
import { BANNED_CODING_TOOLS } from "./allowlist.js";
import { coresearchResourceLoader } from "./coresearchResourceLoader.js";

const srcDir = path.dirname(fileURLToPath(import.meta.url));

describe("createCoResearchAgentSession", () => {
  it("never exposes Pi coding tools", async () => {
    const session = await createCoResearchAgentSession({
      model: stubSessionModel(),
      projectId: "11111111-1111-1111-1111-111111111111",
      threadId: "22222222-2222-2222-2222-222222222222",
    });
    try {
      const active = session.agent.state.tools.map((t) => t.name);
      for (const banned of BANNED_CODING_TOOLS) {
        assert.equal(active.includes(banned), false, banned);
      }
    } finally {
      session.dispose();
    }
  });

  it("exposed tool set matches RESEARCH_TOOL_ALLOWLIST exactly", async () => {
    const session = await createCoResearchAgentSession({
      model: stubSessionModel(),
      projectId: "11111111-1111-1111-1111-111111111111",
      threadId: "22222222-2222-2222-2222-222222222222",
    });
    try {
      const active = session.agent.state.tools.map((t) => t.name).sort();
      assert.deepEqual(active, [...RESEARCH_TOOL_ALLOWLIST].sort());
    } finally {
      session.dispose();
    }
  });

  it("ResourceLoader returns no discovered extensions or files", () => {
    const ext = coresearchResourceLoader.getExtensions();
    assert.deepEqual(ext.extensions, []);
    assert.deepEqual(ext.errors, []);
    assert.deepEqual(coresearchResourceLoader.getAgentsFiles().agentsFiles, []);
    assert.deepEqual(coresearchResourceLoader.getPrompts().prompts, []);
    assert.equal(coresearchResourceLoader.getSkills().skills.length, 0);
    assert.ok(coresearchResourceLoader.getSystemPrompt());
  });

  it("production sources only import createAgentSession in the factory file", () => {
    const files = readdirSync(srcDir).filter(
      (name) =>
        name.endsWith(".ts") &&
        !name.endsWith(".test.ts") &&
        name !== "createCoResearchAgentSession.ts",
    );
    for (const name of files) {
      const text = readFileSync(path.join(srcDir, name), "utf8");
      assert.equal(
        text.includes("createAgentSession"),
        false,
        `${name} must not import createAgentSession`,
      );
    }
    const toolsDir = path.join(srcDir, "tools");
    for (const name of readdirSync(toolsDir).filter((n) => n.endsWith(".ts"))) {
      const text = readFileSync(path.join(toolsDir, name), "utf8");
      assert.equal(text.includes("createAgentSession"), false, name);
    }
  });
});
