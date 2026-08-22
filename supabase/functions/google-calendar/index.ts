import { cors, json, admin, getConfig, checkApiKey } from '../_shared/util.ts'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const SCOPE =
  'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email'

type Cfg = Record<string, string>

/** Return a valid access token, refreshing if it is expired/near expiry. */
async function getAccessToken(sb: SupabaseClient, cfg: Cfg): Promise<string | null> {
  const { data: cal } = await sb.from('calendar_sync').select('*').eq('id', 1).single()
  if (!cal?.access_token) return null

  const expiry = cal.token_expiry ? new Date(cal.token_expiry).getTime() : 0
  if (expiry > Date.now() + 60_000) return cal.access_token

  if (!cal.refresh_token) return cal.access_token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.GOOGLE_CLIENT_ID,
      client_secret: cfg.GOOGLE_CLIENT_SECRET,
      refresh_token: cal.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return cal.access_token
  const tok = await res.json()
  const newExpiry = new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString()
  await sb.from('calendar_sync').update({ access_token: tok.access_token, token_expiry: newExpiry }).eq('id', 1)
  return tok.access_token
}

async function pushTasks(sb: SupabaseClient, token: string): Promise<number> {
  const { data: tasks } = await sb
    .from('tasks')
    .select('id, title, notes, due_date, google_event_id')
    .neq('status', 'done')
    .not('due_date', 'is', null)
  if (!tasks) return 0

  let count = 0
  for (const t of tasks) {
    const start = new Date(t.due_date)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const event = {
      summary: t.title,
      description: t.notes ?? undefined,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    }
    const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
    const url = t.google_event_id ? `${base}/${t.google_event_id}` : base
    const method = t.google_event_id ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    })
    if (res.ok) {
      const created = await res.json()
      if (!t.google_event_id && created.id) {
        await sb.from('tasks').update({ google_event_id: created.id }).eq('id', t.id)
      }
      count++
    }
  }
  return count
}

async function pullEvents(sb: SupabaseClient, token: string): Promise<number> {
  const now = new Date()
  const timeMax = new Date(now.getTime() + 14 * 24 * 3600 * 1000)
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
  url.searchParams.set('timeMin', now.toISOString())
  url.searchParams.set('timeMax', timeMax.toISOString())
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('maxResults', '100')

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return 0
  const data = await res.json()
  const items = (data.items ?? []).filter((e: { start?: { dateTime?: string } }) => e.start?.dateTime)

  // Replace the future window with the freshly pulled events.
  await sb.from('calendar_events').delete().gte('start_at', now.toISOString())

  if (items.length > 0) {
    const rows = items.map((e: { id: string; summary?: string; start: { dateTime: string }; end: { dateTime: string } }) => ({
      google_id: e.id,
      title: e.summary ?? '(بدون عنوان)',
      start_at: e.start.dateTime,
      end_at: e.end.dateTime,
    }))
    await sb.from('calendar_events').upsert(rows, { onConflict: 'google_id' })
  }
  return items.length
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = new URL(req.url)
  const action = url.pathname.split('/').filter(Boolean).pop()
  const sb = admin()
  const cfg = await getConfig(sb)

  try {
    // ---- OAuth start (browser navigation) ----
    if (action === 'auth') {
      if (!cfg.GOOGLE_CLIENT_ID) return json({ error: 'Google OAuth غير مُعد بعد' }, 400)
      const appRedirect = url.searchParams.get('redirect') ?? '/'
      const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      auth.searchParams.set('client_id', cfg.GOOGLE_CLIENT_ID)
      auth.searchParams.set('redirect_uri', cfg.GOOGLE_REDIRECT_URI)
      auth.searchParams.set('response_type', 'code')
      auth.searchParams.set('scope', SCOPE)
      auth.searchParams.set('access_type', 'offline')
      auth.searchParams.set('prompt', 'consent')
      auth.searchParams.set('state', appRedirect)
      return Response.redirect(auth.toString(), 302)
    }

    // ---- OAuth callback (from Google) ----
    if (action === 'callback') {
      const code = url.searchParams.get('code')
      const appRedirect = url.searchParams.get('state') ?? '/'
      if (!code) return json({ error: 'missing code' }, 400)

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: cfg.GOOGLE_CLIENT_ID,
          client_secret: cfg.GOOGLE_CLIENT_SECRET,
          redirect_uri: cfg.GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      })
      if (!tokenRes.ok) return json({ error: await tokenRes.text() }, 502)
      const tok = await tokenRes.json()

      let email: string | null = null
      const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tok.access_token}` },
      })
      if (infoRes.ok) email = (await infoRes.json()).email ?? null

      await sb
        .from('calendar_sync')
        .update({
          access_token: tok.access_token,
          refresh_token: tok.refresh_token ?? null,
          token_expiry: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString(),
          connected_email: email,
        })
        .eq('id', 1)
      // Enable both directions by default on first connect.
      await sb.from('settings').update({ cal_push_to_google: true, cal_pull_from_google: true }).eq('id', 1)

      return Response.redirect(appRedirect, 302)
    }

    // ---- The rest require the app key ----
    if (!checkApiKey(req, cfg.APP_ANON_KEY)) return json({ error: 'unauthorized' }, 401)

    if (action === 'disconnect') {
      await sb
        .from('calendar_sync')
        .update({ access_token: null, refresh_token: null, token_expiry: null, connected_email: null })
        .eq('id', 1)
      return json({ ok: true })
    }

    if (action === 'sync') {
      const token = await getAccessToken(sb, cfg)
      if (!token) return json({ error: 'not connected' }, 400)
      const { data: settings } = await sb.from('settings').select('*').eq('id', 1).single()
      const pushed = settings?.cal_push_to_google ? await pushTasks(sb, token) : 0
      const pulled = settings?.cal_pull_from_google ? await pullEvents(sb, token) : 0
      await sb.from('calendar_sync').update({ last_synced_at: new Date().toISOString() }).eq('id', 1)
      return json({ pushed, pulled })
    }

    return json({ error: 'not found' }, 404)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unknown error' }, 500)
  }
})
