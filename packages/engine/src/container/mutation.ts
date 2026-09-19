// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
//
// Ported from Huabu-main/packages/shared/src/canvas-engine/container/mutation.ts.
// Only the two parent-change helpers ticket 05 needs.

import { canParentNode } from "./policy.js";
import {
  createAbsolutePositionGetter,
  getDescendantIds,
  indexById,
  normalizeTreeOrder,
  subPos,
  type NestableNode,
} from "./tree.js";

export function moveNodeIntoContainer(
  nodes: NestableNode[],
  nodeId: string,
  containerId: string,
): NestableNode[] {
  const byId = indexById(nodes);
  const node = byId.get(nodeId);
  const container = byId.get(containerId);

  if (!canParentNode(container, node)) return nodes;
  if (node?.parentId === containerId) return nodes;

  const descendants = new Set(getDescendantIds(nodes, nodeId));
  if (descendants.has(containerId)) return nodes;

  const getAbs = createAbsolutePositionGetter(byId);
  const nodeAbs = getAbs(nodeId);
  const containerAbs = getAbs(containerId);
  if (!nodeAbs || !containerAbs) return nodes;

  const nextNodes = nodes.map((candidate) =>
    candidate.id === nodeId
      ? {
          ...candidate,
          parentId: containerId,
          position: subPos(nodeAbs, containerAbs),
          zIndex: -1,
        }
      : candidate,
  );
  return normalizeTreeOrder(nextNodes);
}

export function moveNodeOutOfContainer(
  nodes: NestableNode[],
  nodeId: string,
): NestableNode[] {
  const byId = indexById(nodes);
  const node = byId.get(nodeId);
  if (!node?.parentId) return nodes;

  const nodeAbs = createAbsolutePositionGetter(byId)(nodeId);
  if (!nodeAbs) return nodes;

  const nextNodes = nodes.map((candidate) => {
    if (candidate.id !== nodeId) return candidate;
    const { parentId: _parentId, zIndex: _zIndex, ...rest } = candidate;
    return {
      ...rest,
      position: nodeAbs,
    };
  });
  return normalizeTreeOrder(nextNodes);
}
