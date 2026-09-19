// SSE subscription for one agent run (docs/spec/06 §1 / ADR 0012).
// Uses fetch so the Supabase JWT can go on Authorization — EventSource
// cannot set headers. After disconnect, callers re-read GET messages.

import { useEffect } from 'react'

import { apiUrl } from '../api/_client'
import { supabase } from '../lib/supabase'

export type AgentStreamHandler = (type: string, payload: unknown) => void

export function useAgentRunStream(runId: string | null, onEvent: AgentStreamHandler) {
  useEffect(() => {
    if (!runId) return
    const ac = new AbortController()
    let cancelled = false

    void (async () => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token || cancelled) return
      const response = await fetch(apiUrl(`/api/runs/${runId}/stream`), {
        headers: { Authorization: `Bearer ${token}` },
        signal: ac.signal,
      })
      if (!response.ok || !response.body) return
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (!cancelled) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const block of parts) {
          let type = 'message'
          let data = ''
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) type = line.slice(6).trim()
            if (line.startsWith('data:')) data += line.slice(5).trim()
          }
          if (!data) continue
          try {
            onEvent(type, JSON.parse(data) as unknown)
          } catch {
            onEvent(type, data)
          }
        }
      }
    })().catch((err: unknown) => {
      if (ac.signal.aborted) return
      console.error(err)
    })

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [runId, onEvent])
}
