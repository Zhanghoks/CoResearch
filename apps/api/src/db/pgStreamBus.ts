// LISTEN/NOTIFY implementation of AgentStreamBus (ADR 0012).
// Lives next to the pg pool so the import boundary stays intact.

import { runEventChannel } from "@coresearch/shared";
import pg from "pg";

import type { AgentStreamBus, AgentStreamEvent } from "../agent/streamBus.js";

export function createPgStreamBus(connectionString: string): AgentStreamBus {
  const listeners = new Map<string, Set<(event: AgentStreamEvent) => void>>();
  const client = new pg.Client({ connectionString });
  let connected: Promise<void> | null = null;

  const ensure = () => {
    if (!connected) {
      connected = client.connect().then(() => {
        client.on("notification", (msg) => {
          if (!msg.channel.startsWith("agent_run_")) return;
          let event: AgentStreamEvent;
          try {
            event = JSON.parse(msg.payload ?? "{}") as AgentStreamEvent;
          } catch {
            return;
          }
          if (!event || typeof event.type !== "string") return;
          const hyphenated = restoreRunId(msg.channel.slice("agent_run_".length));
          const set =
            listeners.get(hyphenated) ?? listeners.get(msg.channel.slice("agent_run_".length));
          if (!set) return;
          for (const emit of set) emit(event);
        });
      });
    }
    return connected;
  };

  return {
    listen(runId, emit) {
      let set = listeners.get(runId);
      if (!set) {
        set = new Set();
        listeners.set(runId, set);
      }
      set.add(emit);
      const channel = runEventChannel(runId);
      void ensure().then(() => client.query(`LISTEN ${channel}`));
      return () => {
        set.delete(emit);
        if (set.size === 0) {
          listeners.delete(runId);
          void client.query(`UNLISTEN ${channel}`).catch(() => {});
        }
      };
    },
    publish(runId, event) {
      const channel = runEventChannel(runId);
      void ensure().then(() =>
        client.query("SELECT pg_notify($1, $2)", [channel, JSON.stringify(event)]),
      );
    },
  };
}

function restoreRunId(compact: string): string {
  if (compact.length !== 32) return compact;
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}
