// Two write entries (docs/spec/04-research-domain-service.md §2 / ADR 0001).
// Permission is the function you called, not a `source` field the client
// can forge. executeFromRequest never applies RESEARCH_OWNED keys.
// executeAsProjector is the only entry that may.

import type {
  CanvasNodeCreateInput,
  CanvasNodeDataMergePatch,
  CanvasNodeId,
} from "@coresearch/shared";

import { patchTouchesOwnedKeys } from "./ownership.js";

export type ExecuteResult = {
  applied: boolean;
  reason?: string;
};

export type ProjectionPlan = {
  canvasId: string;
  createInputs: CanvasNodeCreateInput[];
  deleteNodeIds: CanvasNodeId[];
  mergePatches: CanvasNodeDataMergePatch[];
  connectInputs: never[];
};

export type ProjectionResult = {
  applied: boolean;
  reason?: string;
};

export type RequestWriteHost = {
  applyMerge: (patch: CanvasNodeDataMergePatch) => Promise<ExecuteResult>;
};

export type ProjectorWriteHost = {
  applyPlan: (plan: ProjectionPlan) => Promise<ProjectionResult>;
};

/**
 * HTTP / user path. A forged `source: 'system'` on the patch is ignored.
 */
export async function executeFromRequest(
  host: RequestWriteHost,
  patch: CanvasNodeDataMergePatch & { source?: string },
): Promise<ExecuteResult> {
  void patch.source;
  if (patchTouchesOwnedKeys(patch.patch)) {
    return { applied: false, reason: "invalid-scope" };
  }
  return host.applyMerge({ nodeId: patch.nodeId, patch: patch.patch });
}

/** Projector / system path. Owned keys are allowed here. */
export async function executeAsProjector(
  host: ProjectorWriteHost,
  plan: ProjectionPlan,
): Promise<ProjectionResult> {
  return host.applyPlan(plan);
}
