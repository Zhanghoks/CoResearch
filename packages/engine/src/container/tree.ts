// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
//
// Ported verbatim from
// Huabu-main/packages/shared/src/canvas-engine/container/tree.ts. Only the
// symbols ticket 02 needs (normalizeTreeOrder + its helpers) are kept —
// Huabu's fit/mutation/zorder submodules land with the tickets that add
// SET_NODE_GEOMETRY/SET_NODE_PARENT/frame layout.

import { isContainerNode } from "./policy.js";

import type { Node, XYPosition } from "@xyflow/react";

export type NestableNode = Node & {
  parentId?: string;
  data?: Record<string, unknown>;
};

export function addPos(a: XYPosition, b: XYPosition): XYPosition {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function indexById(nodes: NestableNode[]): Map<string, NestableNode> {
  return new Map(nodes.map((n) => [n.id, n] as const));
}

/**
 * Single source of truth for "does this node nest under a live parent?"
 * A dangling `parentId` is treated as top-level.
 */
export function hasLiveParent(
  byId: ReadonlyMap<string, NestableNode>,
  id: string,
): boolean {
  const parentId = byId.get(id)?.parentId;
  return parentId != null && byId.has(parentId);
}

/**
 * Ensures nodes are ordered so parents appear before their children.
 * This is required by React Flow to avoid "parent node not found" errors.
 * Also removes dangling parent references and breaks cycles.
 */
export function normalizeTreeOrder(nodes: NestableNode[]): NestableNode[] {
  const byId = indexById(nodes);
  const getOriginalAbs = createAbsolutePositionGetter(byId);
  const originalIndex = new Map(nodes.map((n, i) => [n.id, i] as const));

  // Fast path: array already satisfies every invariant this function
  // enforces — O(n), zero allocation.
  let alreadyValid = true;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!n.parentId) {
      if (!isContainerNode(n) && n.zIndex === -1) {
        alreadyValid = false;
        break;
      }
      continue;
    }
    const parentIndex = originalIndex.get(n.parentId);
    if (
      parentIndex === undefined ||
      parentIndex >= i ||
      !isContainerNode(byId.get(n.parentId))
    ) {
      alreadyValid = false;
      break;
    }
    if (isContainerNode(byId.get(n.parentId)) && n.zIndex !== -1) {
      alreadyValid = false;
      break;
    }
  }
  if (alreadyValid) return nodes;

  // Drop dangling parent links; ensure frame children share the parent's zIndex.
  const normalized = nodes.map((n) => {
    if (!n.parentId) {
      if (n.type !== "frame" && n.zIndex === -1) {
        const { zIndex: _zIndex, ...rest } = n;
        return rest;
      }
      return n;
    }
    const liveParent = byId.get(n.parentId);
    if (!liveParent || !isContainerNode(liveParent)) {
      const { parentId: _parentId, ...rest } = n;
      const detached =
        liveParent && !isContainerNode(liveParent)
          ? { ...rest, position: getOriginalAbs(n.id) ?? n.position }
          : rest;
      if (detached.zIndex === -1 && !isContainerNode(detached)) {
        const { zIndex: _zIndex, ...clean } = detached;
        return clean;
      }
      return detached;
    }
    const parent = byId.get(n.parentId);
    if (isContainerNode(parent) && n.zIndex !== -1) {
      return { ...n, zIndex: -1 };
    }
    return n;
  });

  const normalizedById = indexById(normalized);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const result: NestableNode[] = [];

  const visit = (id: string) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      // Break cycles defensively by treating the node as root.
      const node = normalizedById.get(id);
      if (node?.parentId) {
        const { parentId: _parentId, ...rest } = node;
        normalizedById.set(id, rest);
      }
      visiting.delete(id);
    }

    const node = normalizedById.get(id);
    if (!node) return;

    visiting.add(id);
    if (node.parentId) visit(node.parentId);
    visiting.delete(id);

    if (visited.has(id)) return;
    visited.add(id);
    result.push(normalizedById.get(id) ?? node);
  };

  const ids = [...normalizedById.keys()].sort((a, b) => {
    return (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0);
  });
  for (const id of ids) visit(id);

  return result;
}

export function getAncestorIds(
  byId: Map<string, NestableNode>,
  nodeId: string,
): string[] {
  const result: string[] = [];

  let current = byId.get(nodeId);
  const visited = new Set<string>([nodeId]);

  while (current?.parentId) {
    const parentId = current.parentId;
    if (visited.has(parentId)) break;
    visited.add(parentId);
    result.push(parentId);
    current = byId.get(parentId);
  }

  return result;
}

export function createAbsolutePositionGetter(byId: Map<string, NestableNode>) {
  const absById = new Map<string, XYPosition | null>();

  return (nodeId: string): XYPosition | null => {
    if (absById.has(nodeId)) return absById.get(nodeId) ?? null;

    const chain: NestableNode[] = [];
    const visited = new Set<string>();

    let currentId: string | undefined = nodeId;
    let baseAbs: XYPosition = { x: 0, y: 0 };

    while (currentId) {
      if (absById.has(currentId)) {
        baseAbs = absById.get(currentId) ?? { x: 0, y: 0 };
        break;
      }

      const current = byId.get(currentId);
      if (!current) {
        absById.set(nodeId, null);
        return null;
      }

      chain.push(current);
      visited.add(current.id);

      const parentId = current.parentId;
      if (!parentId) break;
      if (!byId.has(parentId)) break;
      if (visited.has(parentId)) break;

      if (absById.has(parentId)) {
        baseAbs = absById.get(parentId) ?? { x: 0, y: 0 };
        break;
      }

      currentId = parentId;
    }

    let abs = baseAbs;
    for (let i = chain.length - 1; i >= 0; i -= 1) {
      const n = chain[i];
      abs = addPos(abs, n.position);
      absById.set(n.id, abs);
    }

    return absById.get(nodeId) ?? null;
  };
}

export function getAbsolutePosition(
  nodes: NestableNode[],
  nodeId: string,
): XYPosition | null {
  const byId = indexById(nodes);
  const getAbs = createAbsolutePositionGetter(byId);
  return getAbs(nodeId);
}

export function getDescendantIds(
  nodes: NestableNode[],
  rootId: string,
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    const arr = childrenByParent.get(n.parentId) ?? [];
    arr.push(n.id);
    childrenByParent.set(n.parentId, arr);
  }

  const result: string[] = [];
  const stack: string[] = [...(childrenByParent.get(rootId) ?? [])];

  while (stack.length) {
    const id = stack.pop();
    if (!id) continue;
    result.push(id);

    const kids = childrenByParent.get(id);
    if (kids?.length) stack.push(...kids);
  }

  return result;
}
