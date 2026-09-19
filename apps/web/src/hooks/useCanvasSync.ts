// Canvas Realtime + catch-up (docs/spec/06 §1 / ADR 0012).
// Separate from useAgentRunStream — the two buses never share a client.

import { useEffect } from 'react'

import { nextSyncAction } from '@coresearch/shared'

import { supabase } from '../lib/supabase'

export function useCanvasSync(
  canvasId: string | undefined,
  versionRef: { current: number },
  handlers: {
    apply: (deltas: unknown, toVersion: number) => void
    catchUp: (canvasId: string) => void
  },
) {
  const { apply, catchUp } = handlers

  useEffect(() => {
    if (!canvasId) return
    const channel = supabase
      .channel(`canvas-deltas:${canvasId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'canvas_deltas',
          filter: `canvas_id=eq.${canvasId}`,
        },
        (payload) => {
          const row = payload.new as {
            from_version: number
            to_version: number
            deltas: unknown
          }
          const action = nextSyncAction(
            versionRef.current,
            Number(row.from_version),
            Number(row.to_version),
          )
          if (action === 'ignore') return
          if (action === 'apply') {
            apply(row.deltas, Number(row.to_version))
            return
          }
          catchUp(canvasId)
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [apply, canvasId, catchUp, versionRef])
}
