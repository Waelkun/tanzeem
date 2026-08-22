import { functionsUrl, invokeFunction } from './supabase'

/** Begin Google OAuth by sending the browser to the edge function's auth entry. */
export function connectGoogle() {
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  const redirect = window.location.origin + '/settings'
  const url = `${functionsUrl}/google-calendar/auth?apikey=${encodeURIComponent(anon)}&redirect=${encodeURIComponent(redirect)}`
  window.location.href = url
}

export async function syncNow(): Promise<{ pushed: number; pulled: number }> {
  return invokeFunction('google-calendar/sync', {})
}

export async function disconnectGoogle(): Promise<void> {
  await invokeFunction('google-calendar/disconnect', {})
}
