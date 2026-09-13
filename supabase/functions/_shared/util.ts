// Shared helpers for edge functions (duplicated per-function at deploy time).
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

/** Service-role client (bypasses RLS) — used to read private app_config. */
export function admin() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
}

export async function getConfig(sb: ReturnType<typeof admin>): Promise<Record<string, string>> {
  const { data } = await sb.from('app_config').select('key, value')
  const out: Record<string, string> = {}
  for (const row of data ?? []) out[row.key] = row.value
  return out
}

/** Lightweight guard: require the caller to present the expected anon key. */
export function checkApiKey(req: Request, expected: string | undefined): boolean {
  const provided = req.headers.get('apikey') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  return !!expected && provided === expected
}

/**
 * A Supabase client bound to the CALLER's JWT, so every query runs as that user
 * and RLS scopes the data to them. Use this (not admin()) to read/write a
 * signed-in user's rows inside a function.
 */
export function userClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization') ?? ''
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
}

export interface AuthUser {
  id: string
  email: string | null
  ai_enabled: boolean
  role: string
}

/**
 * Validate the caller's JWT (via the service-role client) and load their profile
 * flags. Returns null when there is no valid signed-in user — an anon-key-only
 * request (no session) resolves to null, which callers treat as unauthorized.
 */
export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  const sb = admin()
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  if (!jwt) return null
  const { data, error } = await sb.auth.getUser(jwt)
  if (error || !data.user) return null
  const { data: profile } = await sb
    .from('profiles')
    .select('ai_enabled, role')
    .eq('id', data.user.id)
    .maybeSingle()
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    ai_enabled: !!profile?.ai_enabled,
    role: profile?.role ?? 'user',
  }
}
