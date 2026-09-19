// Pi SDK event names → CoResearch SSE names (ADR 0012 / docs/spec/05 §5).
// Token deltas are ephemeral: this adapter never writes agent_messages.

const EVENT_MAP: Record<string, string> = {
  agent_start: "run.started",
  message_start: "message.started",
  message_update: "message.delta",
  message_end: "message.completed",
  tool_execution_start: "tool.started",
  tool_execution_update: "tool.updated",
  tool_execution_end: "tool.completed",
  agent_end: "run.completed",
};

const NOTIFY_BYTE_LIMIT = 7500;

export type AdaptedEvent = { type: string; payload: unknown };

export function adaptPiEvent(event: { type: string; [k: string]: unknown }): AdaptedEvent | null {
  if (event.type === "message_update") {
    const inner = event.assistantMessageEvent ?? event.event;
    if (inner && typeof inner === "object" && "type" in inner) {
      if ((inner as { type: string }).type !== "text_delta") return null;
    }
  }
  const mapped = EVENT_MAP[event.type];
  if (!mapped) return null;
  return { type: mapped, payload: pickSerializable(event) };
}

export { runEventChannel } from "@coresearch/shared";

export function pickSerializable(event: unknown): unknown {
  const json = JSON.stringify(event, (_key, value) => {
    if (typeof value === "function") return undefined;
    if (typeof value === "bigint") return value.toString();
    return value;
  });
  if (json.length <= NOTIFY_BYTE_LIMIT) return JSON.parse(json) as unknown;
  return { truncated: true, preview: json.slice(0, NOTIFY_BYTE_LIMIT) };
}

