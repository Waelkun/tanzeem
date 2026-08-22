import { cors, json, admin, getConfig } from '../_shared/util.ts'
import { sendToAll } from '../_shared/push.ts'

// Invoked every minute by pg_cron (via pg_net) to send due-task reminders.
// Guarded by a shared CRON_SECRET header so it can't be triggered publicly.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const sb = admin()
    const cfg = await getConfig(sb)

    const secret = req.headers.get('x-cron-secret')
    if (!cfg.CRON_SECRET || secret !== cfg.CRON_SECRET) return json({ error: 'unauthorized' }, 401)

    const { data: settings } = await sb.from('settings').select('*').eq('id', 1).single()
    if (!settings?.notif_task_reminders) return json({ sent: 0, skipped: 'reminders disabled' })

    const now = new Date()
    const soon = new Date(now.getTime() + 60 * 1000) // due within the next minute
    const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000)

    const { data: due } = await sb
      .from('tasks')
      .select('id, title, due_date')
      .neq('status', 'done')
      .eq('reminder_sent', false)
      .not('due_date', 'is', null)
      .lte('due_date', soon.toISOString())
      .gte('due_date', dayAgo.toISOString())

    if (!due || due.length === 0) return json({ sent: 0 })

    let total = 0
    for (const task of due) {
      const r = await sendToAll(sb, cfg, {
        title: 'تذكير بمهمة',
        body: task.title,
        url: '/',
        tag: `task-${task.id}`,
      })
      total += r.sent
      await sb.from('tasks').update({ reminder_sent: true }).eq('id', task.id)
    }

    return json({ reminders: due.length, pushes: total })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unknown error' }, 500)
  }
})
