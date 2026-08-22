import { format, formatDistanceToNow, isToday, isTomorrow, isPast, parseISO } from 'date-fns'
import { ar } from 'date-fns/locale'

const opts = { locale: ar }

export function fmtTime(iso: string | Date) {
  const d = typeof iso === 'string' ? parseISO(iso) : iso
  return format(d, 'h:mm a', opts)
}

export function fmtDate(iso: string | Date) {
  const d = typeof iso === 'string' ? parseISO(iso) : iso
  return format(d, 'd MMMM', opts)
}

export function fmtDateTime(iso: string | Date) {
  const d = typeof iso === 'string' ? parseISO(iso) : iso
  return format(d, 'd MMM • h:mm a', opts)
}

export function fmtWeekday(iso: string | Date) {
  const d = typeof iso === 'string' ? parseISO(iso) : iso
  return format(d, 'EEEE', opts)
}

export function relative(iso: string | Date) {
  const d = typeof iso === 'string' ? parseISO(iso) : iso
  return formatDistanceToNow(d, { addSuffix: true, ...opts })
}

export function dueLabel(iso: string | null): { text: string; overdue: boolean } | null {
  if (!iso) return null
  const d = parseISO(iso)
  if (isToday(d)) return { text: `اليوم ${fmtTime(d)}`, overdue: isPast(d) }
  if (isTomorrow(d)) return { text: `غداً ${fmtTime(d)}`, overdue: false }
  return { text: fmtDateTime(d), overdue: isPast(d) }
}

/** Format seconds as HH:MM:SS (or MM:SS when under an hour). */
export function fmtDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

/** Format hours as a compact Arabic string, e.g. "12.5 س". */
export function fmtHours(hours: number): string {
  return `${Math.round(hours * 10) / 10} س`
}

/**
 * Format a duration in seconds as a compact Arabic string that never rounds away
 * short sessions, e.g. "2 س 15 د"، "3 د 10 ث"، "10 ث".
 */
export function fmtDurationAr(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  if (s === 0) return '0 ث'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h} س`)
  if (m > 0) parts.push(`${m} د`)
  // Only surface seconds when the total is under an hour, so they stay meaningful.
  if (sec > 0 && h === 0) parts.push(`${sec} ث`)
  return parts.join(' ')
}

export const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

// Compact weekday labels (no «ال» التعريف) for tight UI like the schedule strip.
// Indexed by getDay(): 0 = Sunday … 6 = Saturday.
export const WEEKDAYS_SHORT_AR = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']

export function todayISODate(): string {
  return format(new Date(), 'yyyy-MM-dd')
}
