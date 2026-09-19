/** Postgres LISTEN/NOTIFY channel for one agent run (ADR 0012). */
export function runEventChannel(runId: string): string {
  return `agent_run_${runId.replace(/-/g, "")}`;
}
