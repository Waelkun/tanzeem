import { addDays, addMonths, addWeeks, getDaysInMonth, isSameDay, parseISO } from 'date-fns'
import type { Recurrence, Task, TaskUpdate } from './types'

/** Does a task "occur" on the given day (either scheduled that day, or a recurrence match)? */
export function occursOn(task: Task, day: Date): boolean {
  const anchorIso = task.scheduled_start ?? task.due_date
  if (task.recurrence === 'none') {
    return anchorIso ? isSameDay(parseISO(anchorIso), day) : false
  }
  if (!anchorIso) return task.recurrence === 'daily'
  const anchor = parseISO(anchorIso)
  if (anchor > day && !isSameDay(anchor, day)) return false // don't project before the anchor
  switch (task.recurrence) {
    case 'daily':
      return true
    case 'weekly':
      return anchor.getDay() === day.getDay()
    case 'monthly': {
      // Clamp anchors past the month's length (e.g. the 31st) to the last day.
      const dim = getDaysInMonth(day)
      const anchorDay = anchor.getDate()
      return anchorDay === day.getDate() || (anchorDay > dim && day.getDate() === dim)
    }
    default:
      return false
  }
}

/** The hour (0-23) a task is scheduled at on its day, if any. */
export function scheduledHour(task: Task): number | null {
  if (!task.scheduled_start) return null
  return parseISO(task.scheduled_start).getHours()
}

/** Advance one ISO timestamp by a single recurrence interval. */
function advance(iso: string, rec: Recurrence): string {
  const d = parseISO(iso)
  switch (rec) {
    case 'daily':
      return addDays(d, 1).toISOString()
    case 'weekly':
      return addWeeks(d, 1).toISOString()
    case 'monthly':
      return addMonths(d, 1).toISOString()
    default:
      return iso
  }
}

/**
 * Patch that "completes" a recurring task by rolling it forward to its next
 * occurrence (Todoist-style) instead of marking it done forever. All present
 * time anchors advance by one interval; a dateless recurring task gets its next
 * due date seeded from now so it leaves today's list.
 */
export function nextOccurrencePatch(task: Task): TaskUpdate {
  const rec = task.recurrence
  const patch: TaskUpdate = {}
  if (task.due_date) patch.due_date = advance(task.due_date, rec)
  if (task.scheduled_start) patch.scheduled_start = advance(task.scheduled_start, rec)
  if (task.scheduled_end) patch.scheduled_end = advance(task.scheduled_end, rec)
  if (!task.due_date && !task.scheduled_start) {
    patch.due_date = advance(new Date().toISOString(), rec)
  }
  return patch
}
