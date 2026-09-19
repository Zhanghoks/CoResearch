// Ported from Huabu-main/apps/web/src/api/_client.ts (MIT, Microsoft).
//
// Same job: prefix the base URL, JSON-encode, check `response.ok`, and
// throw a typed `ApiError` carrying `.status`/`.code` so call sites don't
// repeat any of it.
//
// One SaaS-specific addition. Huabu was single-user on localhost and
// needed no credentials; CoResearch attaches the Supabase access token as
// a bearer on every call, because the API derives the RLS identity from
// it (ADR 0013). The token is read from the live session per request
// rather than captured once, so a refresh is picked up without a reload.

import { API_CONFIG } from '../config/api'
import { supabase } from '../lib/supabase'

export interface ApiErrorBody {
  message?: string
  code?: string
  details?: unknown
  /** The API currently returns `{error}`; accepted as a message source. */
  error?: string
}

/** Strongly-typed runtime error raised when the server returns a non-2xx. */
export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly details?: unknown

  constructor(status: number, body: Partial<ApiErrorBody>, fallback: string) {
    const message = body.message?.trim() || body.error?.trim() || fallback
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.details = body.details
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body' | 'method'> {
  method?: RequestInit['method']
  /** JSON-serialisable request body. */
  json?: unknown
  /** Custom fallback message when the server omits one. */
  fallbackMessage?: string
}

/** Build the absolute URL from an API-relative path (e.g. `/api/projects`). */
export function apiUrl(path: string): string {
  return path.startsWith('http') ? path : `${API_CONFIG.BASE_URL}${path}`
}

async function readErrorBody(response: Response): Promise<Partial<ApiErrorBody>> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>
    if (body && typeof body === 'object') return body
  } catch {
    /* not JSON — fall through */
  }
  return {}
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { json, fallbackMessage, headers, method, ...rest } = options

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    throw new ApiError(401, {}, 'Not signed in')
  }

  const init: RequestInit = { ...rest }
  init.headers = {
    Authorization: `Bearer ${token}`,
    ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(headers ?? {}),
  }
  if (json !== undefined) init.body = JSON.stringify(json)
  init.method = method ?? (init.body ? 'POST' : 'GET')

  const response = await fetch(apiUrl(path), init)

  if (!response.ok) {
    const body = await readErrorBody(response)
    throw new ApiError(
      response.status,
      body,
      fallbackMessage ??
        `Request to ${path} failed: ${response.status} ${response.statusText}`,
    )
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}
