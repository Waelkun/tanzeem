// Builds a factual, Arabic context block from real user data. Shared by
// ai-chat and ai-daily-plan (copied into each function bundle at deploy).
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export interface UserData {
  contextText: string
  activeTasks: { id: string; title: string; priority: string; due_date: string | null; scheduled_start: string | null }[]
  settings: Record<string, unknown> | null
}

export async function buildUserData(sb: SupabaseClient, tzArg?: string): Promise<UserData> {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString()

  const [tasksRes, sessionsRes, goalsRes, settingsRes, achievementsRes] = await Promise.all([
    sb.from('tasks').select('*').order('created_at', { ascending: false }),
    sb.from('sessions').select('*').gte('started_at', weekAgo),
    sb.from('goal_progress').select('*'),
    sb.from('settings').select('*').eq('id', 1).single(),
    sb.from('achievements').select('*').gte('created_at', weekAgo).order('created_at', { ascending: false }),
  ])

  const tasks = tasksRes.data ?? []
  const sessions = sessionsRes.data ?? []
  const goals = goalsRes.data ?? []
  const settings = settingsRes.data ?? null
  const achievements = achievementsRes.data ?? []

  // Effective timezone: prefer the caller's (browser) timezone, then the stored
  // setting, then a sensible default. The old hardcoded 'Asia/Riyadh' made the
  // model interpret clock times in +03:00 while the UI renders in the browser's
  // local zone — so "18:00" for a user in Germany (CEST, +02:00) landed at 17:00.
  const tz = tzArg || (settings?.timezone as string) || 'Europe/Berlin'

  const active = tasks.filter((t: Record<string, string>) => t.status !== 'done')
  const doneThisWeek = tasks.filter(
    (t: Record<string, string>) => t.status === 'done' && t.completed_at && t.completed_at >= weekAgo,
  )

  // Weekly aggregates. Bucket day-of-week and hour in the USER's timezone, not
  // the (UTC) server clock — otherwise "best day" / "peak hour" drift by the tz
  // offset and disagree with what the app shows the user.
  const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
  const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const zonedFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  })
  let weekSeconds = 0
  const perDay: Record<string, number> = {}
  const perHour = new Array(24).fill(0)
  for (const s of sessions) {
    weekSeconds += s.duration_seconds
    const parts = zonedFmt.formatToParts(new Date(s.started_at))
    const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun'
    const hr = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24
    const day = AR_DAYS[DAY_INDEX[wd] ?? 0]
    perDay[day] = (perDay[day] ?? 0) + s.duration_seconds
    perHour[hr] += s.duration_seconds
  }
  let bestDay: string | null = null
  let bestDaySecs = 0
  for (const [day, secs] of Object.entries(perDay)) {
    if (secs > bestDaySecs) {
      bestDaySecs = secs
      bestDay = day
    }
  }
  let bestHour: number | null = null
  let bestHourSecs = 0
  perHour.forEach((secs: number, h: number) => {
    if (secs > bestHourSecs) {
      bestHourSecs = secs
      bestHour = h
    }
  })

  const fmtHours = (secs: number) => (Math.round((secs / 3600) * 10) / 10).toString()

  // Readable Arabic date-time for the model to show users (in the user's timezone).
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

  const AR_PRIORITY: Record<string, string> = { high: 'عالية', med: 'متوسطة', low: 'منخفضة' }

  const lines: string[] = []
  lines.push(`# التاريخ والوقت الحالي: ${fmtAr(now.toISOString())} (ISO: ${now.toISOString()}، المنطقة الزمنية: ${tz})`)

  lines.push('\n## الأهداف:')
  if (goals.length === 0) lines.push('- لا توجد أهداف.')
  for (const g of goals) {
    lines.push(
      `- ${g.title}: ${fmtHours((g.accumulated_hours ?? 0) * 3600)} ساعة منجزة` +
        (g.target_hours ? ` من ${g.target_hours}` : '') +
        ` — المهام ${g.done_tasks}/${g.total_tasks} (${g.tasks_percent}%)`,
    )
  }

  lines.push('\n## المهام النشطة (المعرّف id للاستخدام الداخلي في الأدوات فقط — لا يُعرض للمستخدم):')
  if (active.length === 0) lines.push('- لا توجد مهام نشطة.')
  for (const t of active) {
    lines.push(
      `- «${t.title}» — الأولوية: ${AR_PRIORITY[t.priority] ?? t.priority}` +
        (t.due_date ? ` — موعد الاستحقاق: ${fmtAr(t.due_date)}` : '') +
        (t.scheduled_start ? ` — مجدولة: ${fmtAr(t.scheduled_start)}` : '') +
        (t.category ? ` — الفئة: ${t.category}` : '') +
        ` [id: ${t.id}]`,
    )
  }

  lines.push('\n## هذا الأسبوع:')
  lines.push(`- إجمالي ساعات العمل: ${fmtHours(weekSeconds)} ساعة`)
  lines.push(`- مهام أُنجزت: ${doneThisWeek.length}`)
  lines.push(`- أكثر يوم إنتاجية: ${bestDay ?? 'غير متوفر'}`)
  lines.push(`- ذروة التركيز: ${bestHour != null ? `${String(bestHour).padStart(2, '0')}:00` : 'غير متوفر'}`)

  lines.push('\n## الإنجازات المسجّلة هذا الأسبوع:')
  if (achievements.length === 0) lines.push('- لا إنجازات مسجّلة هذا الأسبوع.')
  for (const a of achievements) lines.push(`- «${a.text}» (${fmtAr(a.created_at)})`)

  if (settings) {
    lines.push('\n## إعدادات البومودورو:')
    lines.push(
      `- تركيز ${settings.pomodoro_focus_min} دقيقة / استراحة ${settings.pomodoro_break_min} دقيقة / ${settings.pomodoro_cycles} دورات`,
    )
  }

  return {
    contextText: lines.join('\n'),
    activeTasks: active.map((t: Record<string, string>) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      due_date: t.due_date,
      scheduled_start: t.scheduled_start,
    })),
    settings,
  }
}
