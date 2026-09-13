import { supabase } from './supabase'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out.buffer
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** Request permission and subscribe this device to web push. */
export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: 'المتصفح لا يدعم الإشعارات' }
  const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY as string
  if (!vapid) return { ok: false, reason: 'مفتاح VAPID غير مُعد بعد' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'لم يتم منح إذن الإشعارات' }

  const reg = await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    }))

  // Tie this device to the signed-in user (so reminders reach the right person).
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id
  if (!uid) return { ok: false, reason: 'يجب تسجيل الدخول أولاً' }

  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: uid,
      endpoint: json.endpoint!,
      keys: json.keys as unknown as Record<string, string>,
      device_label: navigator.userAgent.slice(0, 80),
    },
    { onConflict: 'endpoint' },
  )
  if (error) return { ok: false, reason: error.message }
  return { ok: true }
}

export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false
  const reg = await navigator.serviceWorker.ready.catch(() => null)
  if (!reg) return false
  const sub = await reg.pushManager.getSubscription()
  return !!sub && Notification.permission === 'granted'
}
