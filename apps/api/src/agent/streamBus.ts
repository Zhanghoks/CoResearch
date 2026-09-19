// In-process Agent SSE bus. Production LISTEN/NOTIFY is the same
// contract (ADR 0012); tests inject this so PGlite does not need NOTIFY.

export type AgentStreamEvent = { type: string; payload: unknown };

export type AgentStreamBus = {
  listen: (runId: string, emit: (event: AgentStreamEvent) => void) => () => void;
  publish: (runId: string, event: AgentStreamEvent) => void;
};

export function createMemoryStreamBus(): AgentStreamBus {
  const listeners = new Map<string, Set<(event: AgentStreamEvent) => void>>();
  return {
    listen(runId, emit) {
      let set = listeners.get(runId);
      if (!set) {
        set = new Set();
        listeners.set(runId, set);
      }
      set.add(emit);
      return () => {
        set.delete(emit);
        if (set.size === 0) listeners.delete(runId);
      };
    },
    publish(runId, event) {
      const set = listeners.get(runId);
      if (!set) return;
      for (const emit of set) emit(event);
    },
  };
}
