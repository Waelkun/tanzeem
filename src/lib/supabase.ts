import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  // Surface a clear error instead of a cryptic runtime failure.
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    // Multi-user: keep the signed-in session in localStorage, refresh it
    // automatically, and pick up the session from the URL after an email
    // confirmation link or a Google OAuth redirect.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: { params: { eventsPerSecond: 5 } },
})

/** Base URL for invoking Edge Functions. */
export const functionsUrl = `${url}/functions/v1`

/** The browser's IANA timezone, e.g. "Europe/Berlin". */
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export async function invokeFunction<T = unknown>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  // Always carry the caller's timezone so server-side AI reasons about clock
  // times in the user's local zone (unless the caller set one explicitly).
  const payload = { tz: browserTimezone(), ...body }

  // Send the signed-in user's access token so the function can identify who is
  // calling (and scope data to them). Fall back to the anon key when there is
  // no session yet.
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token ?? anonKey

  const res = await fetch(`${functionsUrl}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `فشل الطلب (${res.status})`)
  }
  return res.json() as Promise<T>
}
