// Builds a factual, Arabic context block from real user data, plus server-side
// query helpers the assistant can call to compute exact answers on demand.
// Shared by ai-chat and ai-daily-plan (copied into each function bundle at deploy).
//
// The context is a COMPREHENSIVE, all-time snapshot (not a 7-day window): every
// task grouped by state, multi-window time analytics with averages, per-category
// / per-goal / per-task breakdowns, calendar and plans. This is what gives the
// assistant "full vision" — so it stops answering «لا أعرف» for things that are
// actually in the data. For anything not pre-aggregated, queryTime/queryTasks let
// it fetch and compute the precise number server-side (deterministic, no guessing).
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>

export interface RawData {
  tasks: Row[]
  sessions: Row[]
  goals: Row[]
  goalTitleById: Record<string, string>
  perTaskSecs: Record<string, number>
  tz: string
  nowISO: string
}

export interface UserData {
  contextText: string
  activeTasks: { id: string; title: string; priority: string; due_date: string | null; scheduled_start: string | null }[]
  settings: Record<string, unknown> | null
  raw: RawData
}

const AR_PRIORITY: Record<string, string> = { high: 'عالية', med: 'متوسطة', low: 'منخفضة' }
const AR_STATUS: Record<string, string> = { todo: 'قيد الانتظار', doing: 'قيد التنفيذ', done: 'منجزة' }

const round1 = (n: number) => Math.round(n * 10) / 10
const secsToHours = (secs: number) => round1(secs / 3600)

export async function buildUserData(sb: SupabaseClient, tzArg?: string): Promise<UserData> {
  const now = new Date()
  const nowISO = now.toISOString()

  const [tasksRes, sessionsRes, goalsRes, settingsRes, achievementsRes, plansRes, eventsRes] = await Promise.all([
    sb.from('tasks').select('*').order('created_at', { ascending: false }),
    sb.from('sessions').select('*').order('started_at', { ascending: false }),
    sb.from('goal_progress').select('*'),
    sb.from('settings').select('*').eq('id', 1).single(),
    sb.from('achievements').select('*').order('created_at', { ascending: false }).limit(30),
    sb.from('daily_plans').select('*').order('plan_date', { ascending: false }).limit(3),
    sb.from('calendar_events').select('*').gte('start_at', nowISO).order('start_at', { ascending: true }).limit(10),
  ])

  const tasks = tasksRes.data ?? []
  const sessions = sessionsRes.data ?? []
  const goals = goalsRes.data ?? []
  const settings = settingsRes.data ?? null
  const achievements = achievementsRes.data ?? []
  const plans = plansRes.data ?? []
  const events = eventsRes.data ?? []

  // Effective timezone: caller (browser) → stored setting → sensible default.
  const tz = tzArg || (settings?.timezone as string) || 'Europe/Berlin'

  // Zoned formatters (compute everything in the USER's timezone so numbers agree
  // with what the UI shows).
  const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
  const dowHourFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', hourCycle: 'h23' })
  const zonedDate = (iso: string) => dateFmt.format(new Date(iso)) // -> YYYY-MM-DD
  const fmtHours = (secs: number) => secsToHours(secs).toString()
  const fmtAr = (iso: string | null): string => {
    if (!iso) return ''
    try {
      return new Intl.DateTimeFormat('ar', {
        timeZone: tz,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  // Lookups: task-by-id, goal title-by-id, and per-task tracked seconds.
  const taskById: Record<string, Row> = {}
  for (const t of tasks) taskById[t.id] = t
  const goalTitleById: Record<string, string> = {}
  for (const g of goals) if (g.goal_id) goalTitleById[g.goal_id] = g.title

  const perTaskSecs: Record<string, number> = {}
  const perCategorySecs: Record<string, number> = {}
  const perGoalSecs: Record<string, number> = {}
  const perHour = new Array(24).fill(0)
  const perDow: Record<string, number> = {}
  const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
  const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

  // Rolling date-string windows (unambiguous and always correct across DST).
  const dayStr = (offset: number) => zonedDate(new Date(now.getTime() - offset * 86400000).toISOString())
  const todayStr = dayStr(0)
  const last7 = new Set(Array.from({ length: 7 }, (_, i) => dayStr(i)))
  const last30 = new Set(Array.from({ length: 30 }, (_, i) => dayStr(i)))
  const monthPrefix = todayStr.slice(0, 7) // YYYY-MM

  type Win = { secs: number; count: number; days: Set<string> }
  const mk = (): Win => ({ secs: 0, count: 0, days: new Set() })
  const winToday = mk(), winYesterday = mk(), winLast7 = mk(), winLast30 = mk(), winMonth = mk(), winAll = mk()
  const yesterdayStr = dayStr(1)

  for (const s of sessions) {
    const secs = Number(s.duration_seconds) || 0
    const d = zonedDate(s.started_at)
    const bump = (w: Win) => { w.secs += secs; w.count++; w.days.add(d) }
    bump(winAll)
    if (d === todayStr) bump(winToday)
    if (d === yesterdayStr) bump(winYesterday)
    if (last7.has(d)) bump(winLast7)
    if (last30.has(d)) bump(winLast30)
    if (d.startsWith(monthPrefix)) bump(winMonth)

    // Day-of-week / hour peaks (all-time).
    const parts = dowHourFmt.formatToParts(new Date(s.started_at))
    const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun'
    const hr = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24
    perDow[AR_DAYS[DAY_INDEX[wd] ?? 0]] = (perDow[AR_DAYS[DAY_INDEX[wd] ?? 0]] ?? 0) + secs
    perHour[hr] += secs

    // Category / goal / task breakdowns (all-time).
    if (s.task_id) perTaskSecs[s.task_id] = (perTaskSecs[s.task_id] ?? 0) + secs
    const t = s.task_id ? taskById[s.task_id] : null
    const cat = (t?.category as string) || 'بدون تصنيف'
    perCategorySecs[cat] = (perCategorySecs[cat] ?? 0) + secs
    if (t?.goal_id) perGoalSecs[t.goal_id] = (perGoalSecs[t.goal_id] ?? 0) + secs
  }

  const avgPerActiveDay = (w: Win) => (w.days.size ? secsToHours(w.secs / w.days.size) : 0)
  const winLine = (label: string, w: Win) =>
    `- ${label}: ${fmtHours(w.secs)} ساعة — ${w.count} جلسة على ${w.days.size} يوم نشط` +
    (w.days.size ? ` (متوسط ${avgPerActiveDay(w)} ساعة/يوم نشط)` : '')

  let bestDay: string | null = null, bestDaySecs = 0
  for (const [day, secs] of Object.entries(perDow)) if (secs > bestDaySecs) { bestDaySecs = secs; bestDay = day }
  let bestHour: number | null = null, bestHourSecs = 0
  perHour.forEach((secs: number, h: number) => { if (secs > bestHourSecs) { bestHourSecs = secs; bestHour = h } })

  // ---- Task grouping ----
  const active = tasks.filter((t) => t.status !== 'done')
  const done = tasks.filter((t) => t.status === 'done')
  const overdue = active.filter((t) => t.due_date && t.due_date < nowISO)
  const dueToday = active.filter((t) => t.due_date && zonedDate(t.due_date) === todayStr)
  const doing = tasks.filter((t) => t.status === 'doing')
  const counts = {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    doing: doing.length,
    done: done.length,
    overdue: overdue.length,
  }

  const taskLine = (t: Row) =>
    `- «${t.title}» — الحالة: ${AR_STATUS[t.status] ?? t.status} — الأولوية: ${AR_PRIORITY[t.priority] ?? t.priority}` +
    (t.due_date ? ` — الاستحقاق: ${fmtAr(t.due_date)}` : '') +
    (t.scheduled_start ? ` — مجدولة: ${fmtAr(t.scheduled_start)}` : '') +
    (t.category ? ` — الفئة: ${t.category}` : '') +
    (t.goal_id && goalTitleById[t.goal_id] ? ` — الهدف: ${goalTitleById[t.goal_id]}` : '') +
    (perTaskSecs[t.id] ? ` — الوقت المسجّل: ${fmtHours(perTaskSecs[t.id])} ساعة` : '') +
    ` [id: ${t.id}]`

  // ---- Compose the Arabic context block ----
  const lines: string[] = []
  lines.push(`# التاريخ والوقت الحالي: ${fmtAr(nowISO)} (ISO: ${nowISO}، المنطقة الزمنية: ${tz})`)

  lines.push('\n## ملخص سريع:')
  lines.push(
    `- المهام: ${counts.total} إجمالاً (${counts.todo} قيد الانتظار، ${counts.doing} قيد التنفيذ، ${counts.done} منجزة، ${counts.overdue} متأخرة).`,
  )
  lines.push(`- إجمالي وقت العمل المسجّل (كل الوقت): ${fmtHours(winAll.secs)} ساعة عبر ${winAll.count} جلسة.`)

  lines.push('\n## تحليلات الوقت (محسوبة بمنطقتك الزمنية):')
  lines.push(winLine('اليوم', winToday))
  lines.push(winLine('أمس', winYesterday))
  lines.push(winLine('آخر 7 أيام', winLast7))
  lines.push(winLine('آخر 30 يوماً', winLast30))
  lines.push(winLine('هذا الشهر (منذ بدايته)', winMonth))
  lines.push(winLine('الإجمالي الكلي', winAll))
  lines.push(`- أكثر يوم إنتاجية (كل الوقت): ${bestDay ?? 'غير متوفر'}`)
  lines.push(`- ذروة التركيز (كل الوقت): ${bestHour != null ? `${String(bestHour).padStart(2, '0')}:00` : 'غير متوفر'}`)

  const topCats = Object.entries(perCategorySecs).sort((a, b) => b[1] - a[1]).slice(0, 10)
  if (topCats.length) {
    lines.push('\n## الوقت حسب الفئة (كل الوقت):')
    for (const [cat, secs] of topCats) lines.push(`- ${cat}: ${fmtHours(secs)} ساعة`)
  }

  lines.push('\n## الأهداف (المعرّف id للاستخدام الداخلي في الأدوات فقط):')
  if (goals.length === 0) lines.push('- لا توجد أهداف.')
  for (const g of goals) {
    lines.push(
      `- ${g.title}: ${fmtHours((g.accumulated_hours ?? 0) * 3600)} ساعة منجزة` +
        (g.target_hours ? ` من ${g.target_hours}` : '') +
        ` — المهام ${g.done_tasks}/${g.total_tasks} (${g.tasks_percent}%)` +
        ` [id: ${g.goal_id}]`,
    )
  }

  const topTasks = Object.entries(perTaskSecs).sort((a, b) => b[1] - a[1]).slice(0, 15)
  if (topTasks.length) {
    lines.push('\n## أكثر المهام استهلاكاً للوقت (كل الوقت):')
    for (const [id, secs] of topTasks) {
      const t = taskById[id]
      if (t) lines.push(`- «${t.title}»: ${fmtHours(secs)} ساعة [id: ${id}]`)
    }
  }

  lines.push('\n## المهام (المعرّف id للاستخدام الداخلي في الأدوات فقط — لا يُعرض للمستخدم):')
  if (overdue.length) { lines.push('### متأخرة:'); for (const t of overdue) lines.push(taskLine(t)) }
  if (dueToday.length) { lines.push('### مستحقة اليوم:'); for (const t of dueToday) lines.push(taskLine(t)) }
  const restActive = active.filter((t) => !overdue.includes(t) && !dueToday.includes(t))
  if (restActive.length) { lines.push('### نشطة أخرى:'); for (const t of restActive) lines.push(taskLine(t)) }
  if (active.length === 0) lines.push('- لا توجد مهام نشطة.')
  if (done.length) {
    lines.push(`### منجزة حديثاً (أحدث ${Math.min(done.length, 40)} من ${done.length}):`)
    for (const t of done.slice(0, 40)) lines.push(taskLine(t) + (t.completed_at ? ` — أُنجزت: ${fmtAr(t.completed_at)}` : ''))
  }

  if (events.length) {
    lines.push('\n## أحداث التقويم القادمة:')
    for (const e of events) lines.push(`- «${e.title ?? 'حدث'}» من ${fmtAr(e.start_at)} إلى ${fmtAr(e.end_at)}`)
  }

  if (plans.length) {
    lines.push('\n## خطط يومية حديثة:')
    for (const p of plans) {
      const items = Array.isArray(p.items) ? p.items.length : 0
      lines.push(`- ${p.plan_date}: ${items} عنصر — الحالة: ${p.status}`)
    }
  }

  lines.push('\n## الإنجازات المسجّلة (أحدث):')
  if (achievements.length === 0) lines.push('- لا إنجازات مسجّلة.')
  for (const a of achievements) lines.push(`- «${a.text}» (${fmtAr(a.created_at)})`)

  if (settings) {
    lines.push('\n## الإعدادات:')
    lines.push(
      `- بومودورو: تركيز ${settings.pomodoro_focus_min} دقيقة / استراحة ${settings.pomodoro_break_min} دقيقة / ${settings.pomodoro_cycles} دورات.`,
    )
    lines.push(`- السمة: ${settings.theme} — المنطقة الزمنية: ${settings.timezone}`)
  }

  return {
    contextText: lines.join('\n'),
    activeTasks: active.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      due_date: t.due_date,
      scheduled_start: t.scheduled_start,
    })),
    settings,
    raw: { tasks, sessions, goals, goalTitleById, perTaskSecs, tz, nowISO },
  }
}

// ---------------------------------------------------------------------------
// Read-only query helpers. The assistant calls these via tools; the SERVER does
// the arithmetic and returns JSON, so the numbers are exact (never model math).
// ---------------------------------------------------------------------------

function parseBound(v: unknown): number {
  if (typeof v !== 'string' || !v) return NaN
  const ms = Date.parse(v)
  return Number.isNaN(ms) ? NaN : ms
}

/** Aggregate tracked time over an optional [range_start, range_end] window. */
export function queryTime(raw: RawData, args: Record<string, unknown>): string {
  const startMs = parseBound(args.range_start)
  const endMs = parseBound(args.range_end)
  const lo = Number.isNaN(startMs) ? -Infinity : startMs
  const hi = Number.isNaN(endMs) ? Infinity : endMs
  const groupBy = String(args.group_by ?? '')

  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: raw.tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const taskById: Record<string, Row> = {}
  for (const t of raw.tasks) taskById[t.id] = t

  let totalSecs = 0
  let count = 0
  const days = new Set<string>()
  const groups: Record<string, { secs: number; sessions: number }> = {}

  for (const s of raw.sessions) {
    const ms = Date.parse(s.started_at)
    if (ms < lo || ms > hi) continue
    const secs = Number(s.duration_seconds) || 0
    totalSecs += secs
    count++
    days.add(dateFmt.format(new Date(s.started_at)))

    let key: string | null = null
    const t = s.task_id ? taskById[s.task_id] : null
    if (groupBy === 'day') key = dateFmt.format(new Date(s.started_at))
    else if (groupBy === 'category') key = (t?.category as string) || 'بدون تصنيف'
    else if (groupBy === 'goal') key = t?.goal_id ? raw.goalTitleById[t.goal_id] ?? 'هدف غير معروف' : 'بلا هدف'
    else if (groupBy === 'task') key = t?.title ?? (s.task_id ? 'مهمة محذوفة' : 'بلا مهمة')
    if (key != null) {
      groups[key] = groups[key] ?? { secs: 0, sessions: 0 }
      groups[key].secs += secs
      groups[key].sessions++
    }
  }

  const result: Record<string, unknown> = {
    range: { start: args.range_start ?? null, end: args.range_end ?? null },
    total_hours: secsToHours(totalSecs),
    session_count: count,
    active_days: days.size,
    avg_hours_per_active_day: days.size ? secsToHours(totalSecs / days.size) : 0,
  }
  if (groupBy) {
    result.group_by = groupBy
    result.groups = Object.entries(groups)
      .map(([key, v]) => ({ key, hours: secsToHours(v.secs), sessions: v.sessions }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 30)
  }
  return JSON.stringify(result)
}

/** Filter tasks by status / category / goal / date bounds. */
export function queryTasks(raw: RawData, args: Record<string, unknown>): string {
  const status = args.status ? String(args.status) : null
  const category = args.category ? String(args.category) : null
  const goal = args.goal ? String(args.goal) : null
  const dueBefore = parseBound(args.due_before)
  const dueAfter = parseBound(args.due_after)
  const completedBefore = parseBound(args.completed_before)
  const completedAfter = parseBound(args.completed_after)
  const limit = Math.min(Number(args.limit) || 50, 100)

  const goalIdByTitle: Record<string, string> = {}
  for (const [id, title] of Object.entries(raw.goalTitleById)) goalIdByTitle[title] = id

  const matched = raw.tasks
    .filter((t) => {
      if (status && t.status !== status) return false
      if (category && (t.category ?? '') !== category) return false
      if (goal) {
        const wantId = goalIdByTitle[goal] ?? goal
        if (t.goal_id !== wantId) return false
      }
      if (!Number.isNaN(dueBefore) && !(t.due_date && Date.parse(t.due_date) <= dueBefore)) return false
      if (!Number.isNaN(dueAfter) && !(t.due_date && Date.parse(t.due_date) >= dueAfter)) return false
      if (!Number.isNaN(completedBefore) && !(t.completed_at && Date.parse(t.completed_at) <= completedBefore)) return false
      if (!Number.isNaN(completedAfter) && !(t.completed_at && Date.parse(t.completed_at) >= completedAfter)) return false
      return true
    })
    .slice(0, limit)
    .map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      category: t.category ?? null,
      goal: t.goal_id ? raw.goalTitleById[t.goal_id] ?? null : null,
      due_date: t.due_date ?? null,
      completed_at: t.completed_at ?? null,
      tracked_hours: secsToHours(raw.perTaskSecs[t.id] ?? 0),
    }))

  return JSON.stringify({ count: matched.length, tasks: matched })
}
