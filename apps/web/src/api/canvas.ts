// Canvas endpoints (docs/spec/02-api-contract.md §3).

import { apiFetch } from './_client'

import type { CanvasSnapshot } from '@coresearch/shared'

export type { CanvasSnapshot }

export function getCanvas(canvasId: string): Promise<CanvasSnapshot> {
  return apiFetch<CanvasSnapshot>(`/api/canvases/${canvasId}`, {
    fallbackMessage: 'Failed to load canvas',
  })
}
