// Web Push sender (shared by send-push and schedule-check).
import webpush from 'npm:web-push@3.6.7'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

export async function sendToAll(
  sb: SupabaseClient,
  cfg: Record<string, string>,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  webpush.setVapidDetails(cfg.VAPID_SUBJECT, cfg.VAPID_PUBLIC_KEY, cfg.VAPID_PRIVATE_KEY)

  const { data: subs } = await sb.from('push_subscriptions').select('*')
  if (!subs || subs.length === 0) return { sent: 0, failed: 0 }

  let sent = 0
  let failed = 0
  const body = JSON.stringify(payload)

  await Promise.all(
    subs.map(async (row: { id: string; endpoint: string; keys: { p256dh: string; auth: string } }) => {
      try {
        await webpush.sendNotification({ endpoint: row.endpoint, keys: row.keys }, body)
        sent++
      } catch (e) {
        failed++
        const status = (e as { statusCode?: number }).statusCode
        // Subscription expired/gone — remove it.
        if (status === 404 || status === 410) {
          await sb.from('push_subscriptions').delete().eq('id', row.id)
        }
      }
    }),
  )

  return { sent, failed }
}
