// Fail-closed tool surface (ADR 0006 / docs/spec/05 §1, §6).

export const RESEARCH_TOOL_ALLOWLIST = [
  "search_papers",
  "read_paper",
  "inspect_research_state",
  "propose_candidates",
  "propose_revision",
  "ask_user",
] as const;

export const BANNED_CODING_TOOLS = [
  "read",
  "bash",
  "write",
  "edit",
  "powershell",
] as const;

export type ResearchToolName = (typeof RESEARCH_TOOL_ALLOWLIST)[number];

export function assertExposedToolsMatch(
  session: { agent: { state: { tools: Array<{ name: string }> } } },
  allowlist: readonly string[] = RESEARCH_TOOL_ALLOWLIST,
): void {
  const active = session.agent.state.tools.map((t) => t.name).sort();
  const expected = [...allowlist].sort();
  if (active.length !== expected.length || active.some((n, i) => n !== expected[i])) {
    throw new Error(
      `exposed tools [${active.join(", ")}] !== allowlist [${expected.join(", ")}]`,
    );
  }
  for (const banned of BANNED_CODING_TOOLS) {
    if (active.includes(banned)) {
      throw new Error(`banned coding tool exposed: ${banned}`);
    }
  }
}
