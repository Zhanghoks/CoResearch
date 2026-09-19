// Supabase browser client.
//
// docs/spec/02-api-contract.md §0: the browser is allowed to talk to
// Supabase Auth directly (and, later, Realtime + Storage signed URLs).
// It is NOT allowed to read or write the research/canvas tables — those
// all go through the CoResearch API, which is the only thing holding a
// coresearch_app connection. Keep that boundary: no `.from('projects')`
// calls in the web app.

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set — see .env.example',
  )
}

export const supabase = createClient(url, anonKey)
