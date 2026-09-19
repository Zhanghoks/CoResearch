// Canvas endpoints (docs/spec/02-api-contract.md §3).

import { apiFetch } from './_client'

export interface CanvasSnapshot {
  canvasId: string
  projectId: string
  title: string
  /** Owning project's title, so a deep link can render its header. */
  projectTitle: string
  /** Monotonic canvas version; compared against delta versions later. */
  version: number
  /**
   * Empty until ticket 05 (note editing) and ticket 06 (candidate
   * acceptance) put nodes on the board. Typed loosely on purpose —
   * the node/edge wire shape is settled by the slice that first emits one.
   */
  nodes: unknown[]
  edges: unknown[]
}

export function getCanvas(canvasId: string): Promise<CanvasSnapshot> {
  return apiFetch<CanvasSnapshot>(`/api/canvases/${canvasId}`, {
    fallbackMessage: 'Failed to load canvas',
  })
}
