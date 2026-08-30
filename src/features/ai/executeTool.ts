import { supabase } from '@/lib/supabase'
import type { GoalInsert, GoalUpdate, ProposedToolCall, Settings, TaskPriority, TaskStatus, TaskUpdate } from '@/lib/types'
import { PRIORITY_LABELS } from '@/lib/types'

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
    case 'edit_task': {
      const parts: string[] = []
      if (a.title != null) parts.push(`العنوان → «${a.title}»`)
      if (a.priority != null) parts.push(`الأولوية → ${PRIORITY_LABELS[a.priority as TaskPriority] ?? a.priority}`)
      if (a.category != null) parts.push(`الفئة → ${a.category}`)
      if (a.status != null) parts.push(`الحالة → ${a.status}`)
      if (a.due_date != null) parts.push(`الاستحقاق → ${fmtAr(a.due_date)}`)
      if (a.notes != null) parts.push('تحديث الملاحظات')
      return `تعديل «${taskName}»${parts.length ? `: ${parts.join('، ')}` : ''}`
    }
    case 'delete_task':
      return `⚠️ حذف المهمة نهائياً: «${taskName}»`
    case 'create_goal':
      return `إنشاء هدف: «${a.title}»${a.target_hours ? ` — ${a.target_hours} ساعة مستهدفة` : ''}`
    case 'edit_goal': {
      const parts: string[] = []
      if (a.title != null) parts.push(`العنوان → «${a.title}»`)
      if (a.target_hours != null) parts.push(`الساعات المستهدفة → ${a.target_hours}`)
      if (a.archived != null) parts.push(a.archived ? 'أرشفة' : 'إلغاء الأرشفة')
      return `تعديل الهدف${parts.length ? `: ${parts.join('، ')}` : ''}`
    }
    case 'set_pomodoro':
      return `ضبط بومودورو: تركيز ${a.focus_min} د / استراحة ${a.break_min} د`
    case 'update_settings': {
      const parts: string[] = []
      if (a.pomodoro_focus_min != null) parts.push(`تركيز ${a.pomodoro_focus_min} د`)
      if (a.pomodoro_break_min != null) parts.push(`استراحة ${a.pomodoro_break_min} د`)
      if (a.pomodoro_cycles != null) parts.push(`${a.pomodoro_cycles} دورات`)
      if (a.theme != null) parts.push(`السمة → ${a.theme}`)
      if (a.timezone != null) parts.push(`المنطقة الزمنية → ${a.timezone}`)
      if (a.notif_task_reminders != null) parts.push(`تذكيرات المهام → ${a.notif_task_reminders ? 'مفعّلة' : 'معطّلة'}`)
      if (a.notif_pomodoro != null) parts.push(`تنبيه البومودورو → ${a.notif_pomodoro ? 'مفعّل' : 'معطّل'}`)
      if (a.notif_daily_plan != null) parts.push(`تنبيه الخطة اليومية → ${a.notif_daily_plan ? 'مفعّل' : 'معطّل'}`)
      return `تعديل الإعدادات${parts.length ? `: ${parts.join('، ')}` : ''}`
    }
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
    case 'edit_task': {
      const patch: TaskUpdate = {}
      if (a.title != null) patch.title = String(a.title)
      if (a.notes != null) patch.notes = String(a.notes)
      if (a.priority != null) patch.priority = a.priority as TaskPriority
      if (a.category != null) patch.category = String(a.category)
      if (a.due_date != null) patch.due_date = String(a.due_date)
      if (a.status != null) {
        patch.status = a.status as TaskStatus
        patch.completed_at = a.status === 'done' ? new Date().toISOString() : null
      }
      const { error } = await supabase.from('tasks').update(patch).eq('id', String(a.task_id))
      if (error) throw error
      return 'تم تعديل المهمة.'
    }
    case 'delete_task': {
      const { error } = await supabase.from('tasks').delete().eq('id', String(a.task_id))
      if (error) throw error
      return 'تم حذف المهمة.'
    }
    case 'create_goal': {
      const insert: GoalInsert = { title: String(a.title) }
      if (a.description != null) insert.description = String(a.description)
      if (a.target_hours != null) insert.target_hours = Number(a.target_hours)
      if (a.color != null) insert.color = String(a.color)
      const { error } = await supabase.from('goals').insert(insert)
      if (error) throw error
      return 'تم إنشاء الهدف.'
    }
    case 'edit_goal': {
      const patch: GoalUpdate = {}
      if (a.title != null) patch.title = String(a.title)
      if (a.description != null) patch.description = String(a.description)
      if (a.target_hours != null) patch.target_hours = Number(a.target_hours)
      if (a.archived != null) patch.archived = Boolean(a.archived)
      const { error } = await supabase.from('goals').update(patch).eq('id', String(a.goal_id))
      if (error) throw error
      return 'تم تعديل الهدف.'
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
    case 'update_settings': {
      const patch: Partial<Settings> = {}
      const numKeys = ['pomodoro_focus_min', 'pomodoro_break_min', 'pomodoro_long_break_min', 'pomodoro_cycles'] as const
      for (const k of numKeys) if (a[k] != null) (patch as Record<string, unknown>)[k] = Number(a[k])
      const boolKeys = ['notif_task_reminders', 'notif_pomodoro', 'notif_daily_plan'] as const
      for (const k of boolKeys) if (a[k] != null) (patch as Record<string, unknown>)[k] = Boolean(a[k])
      if (a.theme != null) patch.theme = String(a.theme)
      if (a.timezone != null) patch.timezone = String(a.timezone)
      const { error } = await supabase.from('settings').update(patch).eq('id', 1)
      if (error) throw error
      return 'تم تحديث الإعدادات.'
    }
    default:
      return 'لا شيء لتنفيذه.'
  }
}
