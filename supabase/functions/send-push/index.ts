import { cors, json, admin, getConfig, checkApiKey, getAuthUser } from '../_shared/util.ts'
import { sendToAll } from '../_shared/push.ts'

// Sends a push to the CALLING user's own devices. Used for a "test" from
// settings. Guarded by the app anon key + the caller's JWT.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const sb = admin()
    const cfg = await getConfig(sb)
    if (!checkApiKey(req, cfg.APP_ANON_KEY)) return json({ error: 'unauthorized' }, 401)

    const authUser = await getAuthUser(req)
    if (!authUser) return json({ error: 'unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const payload = {
      title: body.title ?? 'منصة تنظيم',
      body: body.body ?? 'إشعار تجريبي',
      url: body.url ?? '/',
      tag: body.tag,
    }
    // Scope to this user's devices only.
    const result = await sendToAll(sb, cfg, payload, authUser.id)
    return json(result)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unknown error' }, 500)
  }
})
