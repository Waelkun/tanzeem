import { supabase } from '@/lib/supabase'
import type { ProposedToolCall, Settings, TaskPriority } from '@/lib/types'

/**
 * For a proposed add_task, ensure due_date is sane: default a missing date to
 * today (end of day), and clamp a past date (a model mistake for a new task) to
 * today keeping its time-of-day. Returns a new tool call so the confirm card and
 * execution stay consistent.
 */
export function normalizeAddTask(tc: ProposedToolCall): ProposedToolCall {
  if (tc.name !== 'add_task') return tc
  const a = { ...tc.arguments }
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59)
  const raw = a.due_date
  if (!raw || typeof raw !== 'string') {
    a.due_date = endToday.toISOString()
  } else {
    const d = new Date(raw)
    if (isNaN(d.getTime())) {
      a.due_date = endToday.toISOString()
    } else if (d < startToday) {
      a.due_date = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        d.getHours(),
        d.getMinutes(),
      ).toISOString()
    }
  }
  return { ...tc, arguments: a }
}

/** Format an ISO string as readable Arabic date-time for confirm cards. */
function fmtAr(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  return new Intl.DateTimeFormat('ar', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

/**
 * Human-readable Arabic summary of a proposed tool call for the confirm card.
 * `taskTitleById` lets the card show the task's real title instead of its id
 * when the model referenced a task by id only.
 */
export function describeToolCall(tc: ProposedToolCall, taskTitleById?: Map<string, string>): string {
  const a = tc.arguments
  const taskName = (a.title as string) ?? taskTitleById?.get(String(a.task_id)) ?? 'المهمة المحددة'
  switch (tc.name) {
    case 'add_task':
      return `إضافة مهمة: «${a.title}»${a.due_date ? ` — تُستحق ${fmtAr(a.due_date)}` : ''}`
    case 'complete_task':
      return `إكمال المهمة: «${taskName}»`
    case 'schedule_task':
      return `جدولة «${taskName}» من ${fmtAr(a.scheduled_start)} إلى ${fmtAr(a.scheduled_end)}`
    case 'set_pomodoro':
      return `ضبط بومودورو: تركيز ${a.focus_min} د / استراحة ${a.break_min} د`
    case 'get_progress':
      return 'عرض تقدّمك الحالي'
    default:
      return 'إجراء غير معروف'
  }
}

/** Execute a tool call the user has confirmed. Returns a short result string. */
export async function executeToolCall(tc: ProposedToolCall): Promise<string> {
  const a = tc.arguments
  switch (tc.name) {
    case 'add_task': {
      const { error } = await supabase.from('tasks').insert({
        title: String(a.title),
        notes: (a.notes as string) ?? null,
        priority: (a.priority as TaskPriority) ?? 'med',
        category: (a.category as string) ?? null,
        due_date: (a.due_date as string) ?? null,
      })
      if (error) throw error
      return 'تمت إضافة المهمة.'
    }
    case 'complete_task': {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', String(a.task_id))
      if (error) throw error
      return 'تم إكمال المهمة.'
    }
    case 'schedule_task': {
      const { error } = await supabase
        .from('tasks')
        .update({
          scheduled_start: String(a.scheduled_start),
          scheduled_end: String(a.scheduled_end),
        })
        .eq('id', String(a.task_id))
      if (error) throw error
      return 'تمت جدولة المهمة.'
    }
    case 'set_pomodoro': {
      const patch: Partial<Settings> = {}
      if (a.focus_min != null) patch.pomodoro_focus_min = Number(a.focus_min)
      if (a.break_min != null) patch.pomodoro_break_min = Number(a.break_min)
      if (a.cycles != null) patch.pomodoro_cycles = Number(a.cycles)
      const { error } = await supabase.from('settings').update(patch).eq('id', 1)
      if (error) throw error
      return 'تم ضبط إعدادات البومودورو.'
    }
    default:
      return 'لا شيء لتنفيذه.'
  }
}
