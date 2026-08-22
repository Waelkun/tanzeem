import { endOfWeek, isToday, isWithinInterval, parseISO, startOfWeek } from 'date-fns'
import type { Session, Task } from './types'

export function todaySeconds(sessions: Session[]): number {
  return sessions.filter((s) => isToday(parseISO(s.started_at))).reduce((sum, s) => sum + s.duration_seconds, 0)
}

export function tasksDoneToday(tasks: Task[]): number {
  return tasks.filter((t) => t.status === 'done' && t.completed_at && isToday(parseISO(t.completed_at))).length
}

/**
 * Streak = consecutive days (ending today or yesterday) that have at least one
 * completed task or logged session.
 */
export function computeStreak(tasks: Task[], sessions: Session[]): number {
  const activeDays = new Set<string>()
  // Key by LOCAL calendar day, not UTC — otherwise a late-night session can bucket
  // into the next UTC day and mis-count the streak around midnight.
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  tasks.forEach((t) => {
    if (t.status === 'done' && t.completed_at) activeDays.add(key(parseISO(t.completed_at)))
  })
  sessions.forEach((s) => {
    if (s.duration_seconds > 0) activeDays.add(key(parseISO(s.started_at)))
  })

  let streak = 0
  const cursor = new Date()
  // Allow the streak to still count if today has no activity yet but yesterday did.
  if (!activeDays.has(key(cursor))) cursor.setDate(cursor.getDate() - 1)
  while (activeDays.has(key(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export interface WeekStats {
  totalHours: number
  totalSeconds: number
  perDay: { day: string; dayIndex: number; hours: number; seconds: number; tasks: number }[]
  mostProductiveDay: string | null
  mostProductiveHour: number | null
  tasksCompleted: number
  completedTasks: { id: string; title: string; at: string }[]
  perTask: TaskTime[]
  weekStart: Date
  weekEnd: Date
}

export interface TaskTime {
  id: string
  title: string
  seconds: number
}

export interface TaskDetail {
  id: string
  title: string
  totalSeconds: number
  /** Full week, Monday→Sunday, so days with no work still show as gaps. */
  perDay: { day: string; dayIndex: number; seconds: number }[]
  /** Individual work sessions, newest first — the "when". */
  sessions: { at: string; seconds: number }[]
}

// Indexed by JS getDay(): 0 = Sunday … 6 = Saturday.
export const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
// Week reading order, starting Monday.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

// Sessions with no task_id are grouped under this synthetic id.
const UNSPECIFIED = '__unspecified__'

function taskTitle(id: string, titleById: Map<string, string>): string {
  return id === UNSPECIFIED ? 'وقت غير مرتبط بمهمة' : titleById.get(id) ?? 'مهمة محذوفة'
}

/**
 * Compute stats for the week containing `refDate` (Monday-start). Pass a date in
 * a past or future week to summarise that week.
 */
export function weekStats(tasks: Task[], sessions: Session[], refDate: Date = new Date()): WeekStats {
  const weekStart = startOfWeek(refDate, { weekStartsOn: 1 }) // Monday
  const weekEnd = endOfWeek(refDate, { weekStartsOn: 1 }) // Sunday 23:59:59
  const within = (iso: string) => isWithinInterval(parseISO(iso), { start: weekStart, end: weekEnd })

  const perDayMap = new Map<number, { seconds: number; tasks: number }>()
  for (let i = 0; i < 7; i++) perDayMap.set(i, { seconds: 0, tasks: 0 })

  const hourBuckets = new Array(24).fill(0)
  let totalSeconds = 0

  sessions.forEach((s) => {
    if (!within(s.started_at)) return
    const d = parseISO(s.started_at)
    const bucket = perDayMap.get(d.getDay())!
    bucket.seconds += s.duration_seconds
    totalSeconds += s.duration_seconds
    hourBuckets[d.getHours()] += s.duration_seconds
  })

  // Whole-week per-task breakdown (dayIndex = null → no day filter).
  const { perTask } = taskBreakdown(tasks, sessions, weekStart, weekEnd, null)

  const completedTasks: { id: string; title: string; at: string }[] = []
  tasks.forEach((t) => {
    if (t.status === 'done' && t.completed_at && within(t.completed_at)) {
      const d = parseISO(t.completed_at)
      perDayMap.get(d.getDay())!.tasks += 1
      completedTasks.push({ id: t.id, title: t.title, at: t.completed_at })
    }
  })
  completedTasks.sort((a, b) => b.at.localeCompare(a.at))

  const perDay = WEEK_ORDER.map((day) => {
    const v = perDayMap.get(day)!
    return {
      day: AR_DAYS[day],
      dayIndex: day,
      hours: Math.round((v.seconds / 3600) * 100) / 100,
      seconds: v.seconds,
      tasks: v.tasks,
    }
  })

  let mostProductiveDay: string | null = null
  let maxSecs = 0
  perDay.forEach((d) => {
    if (d.seconds > maxSecs) {
      maxSecs = d.seconds
      mostProductiveDay = d.day
    }
  })

  let mostProductiveHour: number | null = null
  let maxHourSecs = 0
  hourBuckets.forEach((secs, h) => {
    if (secs > maxHourSecs) {
      maxHourSecs = secs
      mostProductiveHour = h
    }
  })

  return {
    totalHours: Math.round((totalSeconds / 3600) * 100) / 100,
    totalSeconds,
    perDay,
    mostProductiveDay,
    mostProductiveHour,
    tasksCompleted: completedTasks.length,
    completedTasks,
    perTask,
    weekStart,
    weekEnd,
  }
}

/**
 * Per-task time within [weekStart, weekEnd]. Pass `dayIndex` (JS getDay(): 0=Sun…6=Sat)
 * to restrict to a single day of that week; `null` covers the whole week. Sorted desc.
 */
export function taskBreakdown(
  tasks: Task[],
  sessions: Session[],
  weekStart: Date,
  weekEnd: Date,
  dayIndex: number | null = null,
): { perTask: TaskTime[]; totalSeconds: number } {
  const titleById = new Map(tasks.map((t) => [t.id, t.title]))
  const map = new Map<string, number>()
  let totalSeconds = 0

  sessions.forEach((s) => {
    const d = parseISO(s.started_at)
    if (!isWithinInterval(d, { start: weekStart, end: weekEnd })) return
    if (dayIndex != null && d.getDay() !== dayIndex) return
    const key = s.task_id ?? UNSPECIFIED
    map.set(key, (map.get(key) ?? 0) + s.duration_seconds)
    totalSeconds += s.duration_seconds
  })

  const perTask = [...map.entries()]
    .filter(([, sec]) => sec > 0)
    .map(([id, seconds]) => ({ id, title: taskTitle(id, titleById), seconds }))
    .sort((a, b) => b.seconds - a.seconds)

  return { perTask, totalSeconds }
}

/**
 * A day × task matrix for the week: `tasks` are the week's task totals (sorted desc — this
 * defines a stable stack order and color assignment), and `days` is Monday→Sunday, each
 * carrying its total plus a taskId→seconds map. Used to stack the per-day chart by task.
 */
export function weekTaskDayMatrix(
  tasks: Task[],
  sessions: Session[],
  weekStart: Date,
  weekEnd: Date,
): {
  tasks: TaskTime[]
  days: { day: string; dayIndex: number; total: number; perTask: Record<string, number> }[]
} {
  const { perTask } = taskBreakdown(tasks, sessions, weekStart, weekEnd, null)

  const dayMap = new Map<number, { total: number; perTask: Record<string, number> }>()
  for (let i = 0; i < 7; i++) dayMap.set(i, { total: 0, perTask: {} })

  sessions.forEach((s) => {
    const d = parseISO(s.started_at)
    if (!isWithinInterval(d, { start: weekStart, end: weekEnd })) return
    const bucket = dayMap.get(d.getDay())!
    const key = s.task_id ?? UNSPECIFIED
    bucket.perTask[key] = (bucket.perTask[key] ?? 0) + s.duration_seconds
    bucket.total += s.duration_seconds
  })

  const days = WEEK_ORDER.map((day) => {
    const v = dayMap.get(day)!
    return { day: AR_DAYS[day], dayIndex: day, total: v.total, perTask: v.perTask }
  })

  return { tasks: perTask, days }
}

/**
 * Detail for a single task within [weekStart, weekEnd]: total time, a Monday→Sunday
 * per-day breakdown, and each individual session (newest first). `taskId` may be the
 * synthetic "unspecified" id used for sessions with no task.
 */
export function taskDetail(
  taskId: string,
  tasks: Task[],
  sessions: Session[],
  weekStart: Date,
  weekEnd: Date,
): TaskDetail {
  const titleById = new Map(tasks.map((t) => [t.id, t.title]))
  const perDayMap = new Map<number, number>()
  for (let i = 0; i < 7; i++) perDayMap.set(i, 0)
  const matched: { at: string; seconds: number }[] = []
  let totalSeconds = 0

  sessions.forEach((s) => {
    if ((s.task_id ?? UNSPECIFIED) !== taskId) return
    const d = parseISO(s.started_at)
    if (!isWithinInterval(d, { start: weekStart, end: weekEnd })) return
    perDayMap.set(d.getDay(), perDayMap.get(d.getDay())! + s.duration_seconds)
    totalSeconds += s.duration_seconds
    matched.push({ at: s.started_at, seconds: s.duration_seconds })
  })

  const perDay = WEEK_ORDER.map((day) => ({
    day: AR_DAYS[day],
    dayIndex: day,
    seconds: perDayMap.get(day)!,
  }))
  matched.sort((a, b) => b.at.localeCompare(a.at))

  return { id: taskId, title: taskTitle(taskId, titleById), totalSeconds, perDay, sessions: matched }
}
