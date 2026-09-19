// Central command registry.
// Adapted from Huabu-main/packages/shared/src/canvas-engine/commands/index.ts,
// trimmed to the two commands ticket 02 implements. `HandlerMap`/
// `COMMAND_META` stay exhaustive over `CanvasCommandType` by construction —
// adding a command to packages/shared's `CanvasCommand` union without
// registering it here is a TypeScript error, which is the point (see the
// comment on that union in packages/shared/src/canvas/command.ts).

import createNodes from "./createNodes.js";
import deleteNodes from "./deleteNodes.js";

import type {
  CommandHandler,
  CommandHandlerResult,
  CommandMeta,
  CommandDefinition,
} from "./types.js";
import type { CanvasCommand, CanvasCommandType } from "@coresearch/shared";

type HandlerMap = {
  [K in CanvasCommandType]: CommandHandler<Extract<CanvasCommand, { type: K }>>;
};

export const HANDLERS: HandlerMap = {
  CREATE_NODES: createNodes.handler,
  DELETE_NODES: deleteNodes.handler,
};

export const COMMAND_META: Record<CanvasCommandType, CommandMeta> = {
  CREATE_NODES: createNodes.meta,
  DELETE_NODES: deleteNodes.meta,
};

export type {
  CommandHandler,
  CommandHandlerResult,
  CommandMeta,
  CommandDefinition,
};
