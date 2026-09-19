// The "not ready" destination, occupying the slot Huabu's
// WorkspaceSetupPage held: the guard redirects here whenever the app has
// no usable session, and this page's job is to produce one.
//
// Magic link only. OAuth (Google/GitHub) is deferred — every provider
// lands on the same Supabase session afterwards, so the routing and the
// API contract don't change when it's added.

import { useState } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { Navigate } from 'react-router-dom'

import { supabase } from '../lib/supabase'
import { useSessionStore } from '../store/sessionStore'

export default function LoginPage() {
  const isReady = useSessionStore((s) => s.isReady)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  // Already signed in (e.g. the magic-link callback just resolved).
  if (isReady) return <Navigate to="/projects" replace />

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setStatus('sending')
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (signInError) {
      setError(signInError.message)
      setStatus('idle')
      return
    }
    setStatus('sent')
  }

  return (
    <div className="bg-bg-default text-fg-default flex h-full w-full items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">CoResearch</h1>
        <p className="text-fg-muted mt-2 text-sm">输入邮箱，我们会发送一条登录链接。</p>

        {status === 'sent' ? (
          <div className="border-border-default mt-6 rounded-lg border p-4 text-sm">
            登录链接已发送到 <span className="font-medium">{email}</span>，请查收邮件。
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
            <label className="sr-only" htmlFor="email">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="border-border-default bg-bg-subtle focus:border-fg-default w-full rounded-md border px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="bg-fg-default text-bg-default flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-60"
            >
              {status === 'sending' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              发送登录链接
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
