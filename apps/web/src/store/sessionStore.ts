// Auth session store.
//
// Shaped after Huabu-main/apps/web/src/store/workspaceStore.ts (MIT,
// Microsoft): one `init()` the app root awaits once, an `isReady` flag the
// route guard reads, plus `isSyncing`/`error`. Huabu's "is a workspace
// selected?" gate becomes CoResearch's "is the user signed in?" gate —
// same routing shape, different predicate, so `/setup` becomes `/login`.
//
// `init()` is deduped by an in-flight promise for the same reason Huabu
// does it: React StrictMode double-invokes the bootstrap effect.

import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'

interface SessionState {
  /** Live Supabase session, or null when signed out. */
  session: Session | null
  /** Whether the app has a usable signed-in session. */
  isReady: boolean
  /** Whether an init call is in progress. */
  isSyncing: boolean
  /** Last auth error, if any. */
  error: string | null

  /** Resolve the initial session and subscribe to future changes. */
  init: () => Promise<boolean>
  signOut: () => Promise<void>
}

let initInFlight: Promise<boolean> | null = null

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  isReady: false,
  isSyncing: false,
  error: null,

  init: () => {
    initInFlight ??= (async () => {
      set({ isSyncing: true, error: null })
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error

        // Subscribed once, for the app's lifetime: a magic-link callback,
        // a token refresh and a sign-out all arrive through here, so no
        // page needs its own listener.
        supabase.auth.onAuthStateChange((_event, next) => {
          set({ session: next, isReady: Boolean(next) })
        })

        set({ session: data.session, isReady: Boolean(data.session) })
        return Boolean(data.session)
      } catch (err) {
        // Clear the cached promise so a transient failure (offline at
        // startup, Supabase blip) can be retried. Leaving it set would
        // park the user on /login until a full page reload, because
        // `??=` would keep handing back this same resolved-false promise.
        initInFlight = null
        set({ error: err instanceof Error ? err.message : String(err) })
        return false
      } finally {
        set({ isSyncing: false })
      }
    })()
    return initInFlight
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, isReady: false })
  },
}))

/** The signed-in user's email, for display. */
export function useUserEmail(): string | undefined {
  return useSessionStore((s) => s.session?.user.email)
}
