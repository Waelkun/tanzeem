/** Short WebAudio chime used for focus/break-end alerts (no asset needed). */
export function playChime(kind: 'focus-end' | 'break-end' = 'focus-end') {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const now = ctx.currentTime
    const notes = kind === 'focus-end' ? [660, 880, 990] : [520, 660]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = now + i * 0.16
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.4)
    })
    setTimeout(() => ctx.close(), 1200)
  } catch {
    // Audio not available — ignore silently.
  }
}

/** Fire a local (foreground) notification if permission granted. */
export function localNotify(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: '/pwa-192.png', badge: '/pwa-192.png' })
  } catch {
    // Some browsers require the notification to come from the SW; ignore.
  }
}

export function vibrate(pattern: number | number[] = 30) {
  if ('vibrate' in navigator) navigator.vibrate(pattern)
}
