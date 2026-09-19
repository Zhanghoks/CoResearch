// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
//
// @coresearch/engine — pure, server-portable canvas command engine.
// Ported from Huabu-main/packages/shared/src/canvas-engine/.
// `@xyflow/react` is allowed as `import type` only; the runtime entry is
// forbidden (see eslint.config.js).

export {
  executeCanvasCommands,
  type ExecutorOutput,
  type ExecutorOptions,
} from "./executor.js";
export { preAssignIds } from "./preAssignIds.js";
export type {
  CanvasNode,
  CanvasEdge,
  CanvasReadState,
  CanvasWriteResult,
  PendingEffects,
} from "./interfaces.js";
export { type Delta, applyDeltas, invertDelta } from "./delta.js";
export {
  canonicalizeDeltas,
  diffCanvasState,
  stripTransientNodeFields,
  stripTransientEdgeFields,
  TRANSIENT_NODE_FIELDS,
  TRANSIENT_EDGE_FIELDS,
} from "./diff.js";
export { normalizeTreeOrder, isContainerNode } from "./container/index.js";
