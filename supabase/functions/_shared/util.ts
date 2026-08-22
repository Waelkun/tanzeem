// Shared helpers for edge functions (duplicated per-function at deploy time).
import { createClient } from 'jsr:@supabase/supabase-js@2'

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
