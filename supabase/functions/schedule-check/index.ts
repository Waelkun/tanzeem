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

    const now = new Date()
    const soon = new Date(now.getTime() + 60 * 1000) // due within the next minute
    const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000)

    // Due tasks across ALL users; each carries its owner (user_id).
    const { data: due } = await sb
      .from('tasks')
      .select('id, title, due_date, user_id')
      .neq('status', 'done')
      .eq('reminder_sent', false)
      .not('due_date', 'is', null)
      .lte('due_date', soon.toISOString())
      .gte('due_date', dayAgo.toISOString())

    if (!due || due.length === 0) return json({ sent: 0 })

    // Each owner's reminder preference (per-user settings row).
    const owners = [...new Set(due.map((t) => t.user_id).filter(Boolean))] as string[]
    const { data: settingsRows } = await sb
      .from('settings')
      .select('user_id, notif_task_reminders')
      .in('user_id', owners)
    const remindersOn = new Map<string, boolean>()
    for (const s of settingsRows ?? []) remindersOn.set(s.user_id as string, !!s.notif_task_reminders)

    let total = 0
    for (const task of due) {
      // Notify the owner only if they haven't disabled reminders (default on).
      const enabled = task.user_id ? remindersOn.get(task.user_id) ?? true : false
      if (enabled && task.user_id) {
        const r = await sendToAll(
          sb,
          cfg,
          { title: 'تذكير بمهمة', body: task.title, url: '/', tag: `task-${task.id}` },
          task.user_id,
        )
        total += r.sent
      }
      // Mark processed regardless so the row leaves the scan window.
      await sb.from('tasks').update({ reminder_sent: true }).eq('id', task.id)
    }

    return json({ reminders: due.length, pushes: total })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unknown error' }, 500)
  }
})
