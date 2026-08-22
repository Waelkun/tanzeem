import { cors, json, admin, getConfig, checkApiKey } from '../_shared/util.ts'
import { sendToAll } from '../_shared/push.ts'

// Sends a push to all registered devices. Used for a "test" from settings and
// by other server code. Guarded by the app anon key.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const sb = admin()
    const cfg = await getConfig(sb)
    if (!checkApiKey(req, cfg.APP_ANON_KEY)) return json({ error: 'unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const payload = {
      title: body.title ?? 'منصة تنظيم',
      body: body.body ?? 'إشعار تجريبي',
      url: body.url ?? '/',
      tag: body.tag,
    }
    const result = await sendToAll(sb, cfg, payload)
    return json(result)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unknown error' }, 500)
  }
})
