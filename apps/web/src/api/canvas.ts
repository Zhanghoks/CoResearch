// Canvas endpoints (docs/spec/02-api-contract.md §3).

import { apiFetch } from './_client'

import type {
  CanvasCommand,
  CanvasDeltaLog,
  CanvasSnapshot,
  ExecuteCanvasResult,
} from '@coresearch/shared'

export type { CanvasSnapshot, ExecuteCanvasResult }

export function getCanvas(canvasId: string): Promise<CanvasSnapshot> {
  return apiFetch<CanvasSnapshot>(`/api/canvases/${canvasId}`, {
    fallbackMessage: 'Failed to load canvas',
  })
}

export function executeCanvas(
  canvasId: string,
  commands: CanvasCommand[],
): Promise<ExecuteCanvasResult> {
  return apiFetch<ExecuteCanvasResult>(`/api/canvases/${canvasId}/execute`, {
    method: 'POST',
    json: { commands },
    fallbackMessage: 'Failed to execute canvas commands',
  })
}

export function getCanvasDeltas(
  canvasId: string,
  afterVersion: number,
): Promise<CanvasDeltaLog> {
  return apiFetch<CanvasDeltaLog>(
    `/api/canvases/${canvasId}/deltas?afterVersion=${afterVersion}`,
    { fallbackMessage: 'Failed to load canvas deltas' },
  )
}
