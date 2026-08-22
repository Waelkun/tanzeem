import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { ArrowRight, CaretLeft, CaretRight, CheckCircle, Clock, CursorClick, FilePdf, Fire, Sparkle, Trophy, X } from '@phosphor-icons/react'
import ReactMarkdown from 'react-markdown'
import { motion } from 'framer-motion'
import { addWeeks, isWithinInterval, parseISO } from 'date-fns'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAchievements, useSessions, useTasks } from '@/lib/queries'
import { AR_DAYS, computeStreak, taskBreakdown, taskDetail, weekStats, weekTaskDayMatrix } from '@/lib/stats'
import type { Session, Task } from '@/lib/types'
import { invokeFunction } from '@/lib/supabase'
import { fmtDate, fmtDurationAr, fmtTime } from '@/lib/dates'

export default function Summary() {
  const { data: tasks } = useTasks()
  const { data: sessions } = useSessions()
  const { data: achievements } = useAchievements()

  // 0 = current week, -1 = last week, +1 = next week, …
  const [weekOffset, setWeekOffset] = useState(0)
  const refDate = useMemo(() => addWeeks(new Date(), weekOffset), [weekOffset])
  const isCurrentWeek = weekOffset === 0

  const stats = useMemo(() => weekStats(tasks ?? [], sessions ?? [], refDate), [tasks, sessions, refDate])
  const streak = computeStreak(tasks ?? [], sessions ?? [])

  // Achievements logged during the selected week (Monday-start, matching stats).
  const weekAchievements = useMemo(() => {
    return (achievements ?? []).filter((a) =>
      isWithinInterval(parseISO(a.created_at), { start: stats.weekStart, end: stats.weekEnd }),
    )
  }, [achievements, stats.weekStart, stats.weekEnd])

  const reportAchievements = useMemo(
    () => weekAchievements.map((a) => ({ text: a.text, at: a.created_at })),
    [weekAchievements],
  )

  const weekLabel = useMemo(
    () => `${fmtDate(stats.weekStart)} – ${fmtDate(stats.weekEnd)}`,
    [stats.weekStart, stats.weekEnd],
  )

  const [review, setReview] = useState('')
  const [loadingReview, setLoadingReview] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [exportOpen, setExportOpen] = useState(false)

  // Day × task matrix drives the stacked per-day chart and the per-task card, sharing
  // one stable color-per-task assignment (by week ranking).
  const matrix = useMemo(
    () => weekTaskDayMatrix(tasks ?? [], sessions ?? [], stats.weekStart, stats.weekEnd),
    [tasks, sessions, stats.weekStart, stats.weekEnd],
  )
  const colorById = useMemo(() => {
    const m = new Map<string, string>()
    matrix.tasks.forEach((t, i) => m.set(t.id, TASK_COLORS[i % TASK_COLORS.length]))
    return m
  }, [matrix.tasks])
  const titleById = useMemo(() => new Map(matrix.tasks.map((t) => [t.id, t.title])), [matrix.tasks])

  // Bars read right-to-left: Monday sits on the right, Sunday on the left. Flatten each
  // day's task map onto the datum so recharts can stack one <Bar> per task id.
  const chartData = useMemo(
    () =>
      [...matrix.days]
        .reverse()
        .map((d) => ({ day: d.day, dayIndex: d.dayIndex, total: d.total, ...d.perTask })),
    [matrix.days],
  )

  // Per-task card selections. `selectedDay` = JS getDay() index (0=Sun…6=Sat) filtering
  // the task breakdown to one day; `selectedTaskId` drills into a single task's detail.
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  // Changing week invalidates both selections.
  useEffect(() => {
    setSelectedDay(null)
    setSelectedTaskId(null)
  }, [weekOffset])

  const genReview = async () => {
    setLoadingReview(true)
    setReviewError('')
    try {
      const res = await invokeFunction<{ reply: string }>('ai-chat', {
        message:
          'اكتب مراجعة أسبوعية موجزة ومحفّزة لإنتاجيتي بناءً على بياناتي الفعلية فقط (الساعات، المهام المنجزة، أكثر الأيام إنتاجية، والإنجازات المسجّلة). لا تخترع أرقاماً.',
        history: [],
      })
      setReview(res.reply)
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : 'تعذّر إنشاء المراجعة')
    } finally {
      setLoadingReview(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="الملخص الأسبوعي"
        subtitle={isCurrentWeek ? 'نظرة على إنتاجيتك هذا الأسبوع' : `ملخص الأسبوع ${weekLabel}`}
        action={
          <Button variant="soft" size="sm" onClick={() => setExportOpen(true)}>
            <FilePdf size={18} weight="fill" />
            <span className="hidden sm:inline">معاينة وتصدير PDF</span>
          </Button>
        }
      />

      {/* Week navigator — browse past and upcoming weeks */}
      <div className="glass rounded-3xl p-2.5 mb-4 flex items-center justify-between gap-2">
        {/* In RTL, the "previous" (earlier) week sits on the right. */}
        <Button variant="ghost" size="sm" onClick={() => setWeekOffset((w) => w - 1)}>
          <CaretRight size={18} weight="bold" />
          <span className="hidden sm:inline">الأسبوع السابق</span>
        </Button>

        <button
          onClick={() => setWeekOffset(0)}
          className="flex flex-col items-center focus-ring rounded-xl px-3 py-1"
          disabled={isCurrentWeek}
        >
          <span className="text-sm font-semibold text-ink-100 nums">{weekLabel}</span>
          <span className="text-[11px] text-ink-400">
            {isCurrentWeek ? 'هذا الأسبوع' : weekOffset < 0 ? `قبل ${-weekOffset} أسبوع` : `بعد ${weekOffset} أسبوع · العودة لهذا الأسبوع`}
          </span>
        </button>

        <Button variant="ghost" size="sm" onClick={() => setWeekOffset((w) => w + 1)}>
          <span className="hidden sm:inline">الأسبوع التالي</span>
          <CaretLeft size={18} weight="bold" />
        </Button>
      </div>

      {/* Stat cards — bento, not 3 equal cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
        <Stat index={0} icon={<Clock size={18} weight="fill" />} label="إجمالي الوقت" value={fmtDurationAr(stats.totalSeconds)} accent small />
        <Stat index={1} icon={<CheckCircle size={18} weight="fill" />} label="مهام أُنجزت" value={String(stats.tasksCompleted)} />
        <Stat index={2} icon={<Fire size={18} weight="fill" />} label="سلسلة الأيام" value={`${streak}`} />
        <Stat index={3} icon={<Trophy size={18} weight="fill" />} label="إنجازات الأسبوع" value={String(weekAchievements.length)} />
      </div>

      {/* Chart */}
      <div className="glass rounded-3xl p-5 mb-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold tracking-tight">الوقت لكل يوم</h3>
          {stats.mostProductiveHour != null && (
            <span className="text-xs text-ink-400">
              ذروة التركيز حوالي <span className="nums text-ink-200">{String(stats.mostProductiveHour).padStart(2, '0')}:00</span>
            </span>
          )}
        </div>
        <p className="text-[11px] text-ink-500 mb-3">اضغط على أي يوم لعرض المهام التي عملت عليها فيه بالأسفل.</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            {/* onClick on the chart itself → the entire day column is clickable, not just the bar */}
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
              onClick={(state) => {
                const di = (state?.activePayload?.[0]?.payload as { dayIndex?: number } | undefined)?.dayIndex
                if (di == null) return
                setSelectedTaskId(null)
                setSelectedDay((cur) => (cur === di ? null : di))
              }}
              className="cursor-pointer [&_*]:outline-none"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: '#9494a1', fontSize: 12, fontFamily: 'IBM Plex Sans Arabic' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.06)' }}
                content={<DayTasksTooltip colorById={colorById} titleById={titleById} />}
              />
              {/* One stacked segment per task, colored to match «الوقت لكل مهمة». */}
              {matrix.tasks.map((t) => (
                <Bar key={t.id} dataKey={t.id} stackId="day" maxBarSize={44} cursor="pointer">
                  {chartData.map((d, ci) => (
                    <Cell
                      key={ci}
                      fill={colorById.get(t.id)}
                      // Dim other days once one is selected.
                      fillOpacity={selectedDay == null || selectedDay === d.dayIndex ? 1 : 0.28}
                    />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Color legend — which color is which task */}
        {matrix.tasks.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
            {matrix.tasks.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1.5 text-[11px] text-ink-400">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: colorById.get(t.id) }} />
                <span className="truncate max-w-[10rem]">{t.title}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Time per task — colored segments; click a day above to filter, click a task to drill in */}
      <TaskBreakdown
        tasks={tasks ?? []}
        sessions={sessions ?? []}
        weekStart={stats.weekStart}
        weekEnd={stats.weekEnd}
        colorById={colorById}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        selectedTaskId={selectedTaskId}
        onSelectTask={setSelectedTaskId}
      />

      {/* Completed tasks this week */}
      <div className="glass rounded-3xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="grid place-items-center h-8 w-8 rounded-xl bg-accent-faint text-accent-strong">
            <CheckCircle size={18} weight="fill" />
          </span>
          <h3 className="font-semibold tracking-tight">المهام المنجزة هذا الأسبوع</h3>
        </div>
        {stats.completedTasks.length === 0 ? (
          <p className="text-sm text-ink-400">لم تُنجز أي مهمة في هذا الأسبوع بعد.</p>
        ) : (
          <ul className="space-y-2">
            {stats.completedTasks.map((t) => (
              <li key={t.id} className="flex items-start gap-2.5 text-sm">
                <CheckCircle size={16} weight="fill" className="mt-0.5 text-accent shrink-0" />
                <span className="flex-1 text-ink-200">{t.title}</span>
                <span className="text-[11px] text-ink-500 shrink-0">{fmtDate(t.at)} · {fmtTime(t.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Achievements this week */}
      <div className="glass rounded-3xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="grid place-items-center h-8 w-8 rounded-xl bg-accent-faint text-accent-strong">
            <Trophy size={18} weight="fill" />
          </span>
          <h3 className="font-semibold tracking-tight">إنجازات هذا الأسبوع</h3>
        </div>
        {weekAchievements.length === 0 ? (
          <p className="text-sm text-ink-400">لم تسجّل أي إنجاز هذا الأسبوع بعد — سجّل إنجازاتك من تبويب «الإنجازات».</p>
        ) : (
          <ul className="space-y-2">
            {weekAchievements.map((a) => (
              <li key={a.id} className="flex items-start gap-2.5 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                <span className="flex-1 text-ink-200">{a.text}</span>
                <span className="text-[11px] text-ink-500 shrink-0">{fmtDate(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* AI weekly review */}
      <div className="glass rounded-3xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center h-8 w-8 rounded-xl bg-accent-faint text-accent-strong">
              <Sparkle size={18} weight="fill" />
            </span>
            <h3 className="font-semibold tracking-tight">مراجعة الأسبوع من المساعد</h3>
          </div>
          <Button variant="soft" size="sm" onClick={genReview} disabled={loadingReview}>
            {loadingReview ? 'يكتب…' : review ? 'تحديث' : 'أنشئ'}
          </Button>
        </div>

        {loadingReview ? (
          <div className="space-y-2">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-4/5" />
            <div className="skeleton h-4 w-3/5" />
          </div>
        ) : reviewError ? (
          <p className="text-sm text-priority-high">{reviewError}</p>
        ) : review ? (
          <div className="text-sm text-ink-200 leading-relaxed prose-chat">
            <ReactMarkdown>{review}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-ink-400">اضغط «أنشئ» لمراجعة أسبوعك بناءً على بياناتك الحقيقية.</p>
        )}
      </div>

      {/* On-screen preview */}
      <Modal open={exportOpen} onOpenChange={setExportOpen} title="معاينة الملخص" className="max-w-2xl">
        <div dir="rtl">
          <ReportBody stats={stats} streak={streak} review={review} achievements={reportAchievements} weekLabel={weekLabel} />
        </div>
        <div className="flex gap-2 pt-4">
          <Button variant="primary" className="flex-1" onClick={() => window.print()}>
            <FilePdf size={18} weight="fill" />
            تصدير PDF
          </Button>
          <Button variant="ghost" onClick={() => setExportOpen(false)}>
            إغلاق
          </Button>
        </div>
      </Modal>

      {/* Page-level printable copy (hidden on screen, revealed by print CSS) */}
      <div className="print-report" dir="rtl" aria-hidden>
        <ReportBody stats={stats} streak={streak} review={review} achievements={reportAchievements} weekLabel={weekLabel} />
      </div>
    </div>
  )
}

function ReportBody({
  stats,
  streak,
  review,
  achievements,
  weekLabel,
}: {
  stats: ReturnType<typeof weekStats>
  streak: number
  review: string
  achievements: { text: string; at: string }[]
  weekLabel: string
}) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="border-b border-white/10 pb-3">
        <h1 className="text-xl font-bold text-ink-100">الملخص الأسبوعي — منصة تنظيم</h1>
        <p className="text-sm text-ink-400 mt-0.5 nums">{weekLabel}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ReportStat label="إجمالي الوقت" value={fmtDurationAr(stats.totalSeconds)} />
        <ReportStat label="مهام أُنجزت" value={String(stats.tasksCompleted)} />
        <ReportStat label="سلسلة الأيام" value={String(streak)} />
        <ReportStat label="أكثر يوم إنتاجية" value={stats.mostProductiveDay ?? '—'} />
      </div>

      {/* Per-day hours */}
      <div>
        <h2 className="font-semibold text-ink-100 mb-2">الوقت لكل يوم</h2>
        <div className="print-card glass-soft rounded-2xl p-3 divide-y divide-white/[0.06]">
          {stats.perDay.map((d) => (
            <div key={d.day} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-ink-200">{d.day}</span>
              <span className="text-ink-300">
                <span className="nums text-ink-100">{d.seconds > 0 ? fmtDurationAr(d.seconds) : '—'}</span>
                {d.tasks > 0 && <span className="text-ink-500"> · {d.tasks} مهمة</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-task time */}
      {stats.perTask.length > 0 && stats.totalSeconds > 0 && (
        <div>
          <h2 className="font-semibold text-ink-100 mb-2">الوقت لكل مهمة</h2>
          <div className="print-card glass-soft rounded-2xl p-3 divide-y divide-white/[0.06]">
            {stats.perTask.map((t, i) => (
              <div key={t.id} className="flex items-center gap-2.5 py-1.5 text-sm">
                <span
                  className="print-dot h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: TASK_COLORS[i % TASK_COLORS.length] }}
                />
                <span className="flex-1 text-ink-200 truncate">{t.title}</span>
                <span className="nums text-ink-100 shrink-0">{fmtDurationAr(t.seconds)}</span>
                <span className="text-[11px] text-ink-500 nums shrink-0 w-9 text-left">
                  {Math.round((t.seconds / stats.totalSeconds) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed tasks */}
      <div>
        <h2 className="font-semibold text-ink-100 mb-2">المهام المنجزة ({stats.completedTasks.length})</h2>
        {stats.completedTasks.length === 0 ? (
          <p className="text-sm text-ink-400">لا مهام منجزة في هذا الأسبوع.</p>
        ) : (
          <ul className="print-card glass-soft rounded-2xl p-3 space-y-2">
            {stats.completedTasks.map((t) => (
              <li key={t.id} className="flex items-start gap-2.5 text-sm">
                <span className="print-dot mt-1.5 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                <span className="flex-1 text-ink-200">{t.title}</span>
                <span className="text-[11px] text-ink-500 shrink-0 nums">{fmtDate(t.at)} · {fmtTime(t.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Achievements */}
      <div>
        <h2 className="font-semibold text-ink-100 mb-2">إنجازات الأسبوع ({achievements.length})</h2>
        {achievements.length === 0 ? (
          <p className="text-sm text-ink-400">لا إنجازات مسجّلة هذا الأسبوع.</p>
        ) : (
          <ul className="print-card glass-soft rounded-2xl p-3 space-y-2">
            {achievements.map((a, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span className="print-dot mt-1.5 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                <span className="flex-1 text-ink-200">{a.text}</span>
                <span className="text-[11px] text-ink-500 shrink-0 nums">{fmtDate(a.at)} · {fmtTime(a.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* AI review */}
      {review && (
        <div>
          <h2 className="font-semibold text-ink-100 mb-2">مراجعة المساعد</h2>
          <div className="print-card glass-soft rounded-2xl p-3 text-sm text-ink-200 leading-relaxed prose-chat">
            <ReactMarkdown>{review}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

function ReportStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="print-card glass-soft rounded-2xl p-3">
      <p className="text-lg font-semibold text-ink-100 nums">{value}</p>
      <p className="text-xs text-ink-400 mt-0.5">{label}</p>
    </div>
  )
}

// Distinct hues so each task reads as its own color; segment width encodes duration.
const TASK_COLORS = [
  '#34b98a', // accent green
  '#5a9bd4', // blue
  '#d6a24a', // amber
  '#e0755f', // coral
  '#9b7ede', // violet
  '#4ec9b0', // teal
  '#e07fb0', // pink
  '#7fb85a', // olive
]

/** Stacked per-day chart tooltip: day header, total, and each task's share for that day. */
function DayTasksTooltip({
  active,
  label,
  payload,
  colorById,
  titleById,
}: {
  active?: boolean
  label?: string
  payload?: { dataKey?: string | number; value?: number }[]
  colorById: Map<string, string>
  titleById: Map<string, string>
}) {
  if (!active || !payload?.length) return null
  const rows = payload
    .filter((p) => (p.value ?? 0) > 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  const total = rows.reduce((s, p) => s + (p.value ?? 0), 0)

  return (
    <div
      dir="rtl"
      style={{
        background: '#1d1d22',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: 14,
        padding: '8px 12px',
        boxShadow: '0 12px 30px -12px rgba(0,0,0,0.7)',
        fontSize: 13,
        minWidth: 168,
      }}
    >
      <div style={{ color: '#e6e6ea', fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {rows.length === 0 ? (
        <div style={{ color: '#9494a1' }}>لا عمل مسجّل</div>
      ) : (
        <>
          <div style={{ color: '#9494a1', marginBottom: 6 }}>
            الإجمالي: <span style={{ color: '#e6e6ea' }}>{fmtDurationAr(total)}</span>
          </div>
          {rows.map((p) => {
            const id = String(p.dataKey)
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                <span style={{ width: 9, height: 9, borderRadius: 99, background: colorById.get(id), flexShrink: 0 }} />
                <span style={{ flex: 1, color: '#c4c4cd', whiteSpace: 'nowrap' }}>{titleById.get(id) ?? id}</span>
                <span style={{ color: '#e6e6ea' }}>{fmtDurationAr(p.value ?? 0)}</span>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

function TaskBreakdown({
  tasks,
  sessions,
  weekStart,
  weekEnd,
  colorById,
  selectedDay,
  onSelectDay,
  selectedTaskId,
  onSelectTask,
}: {
  tasks: Task[]
  sessions: Session[]
  weekStart: Date
  weekEnd: Date
  // Shared with the per-day chart so a task's color matches everywhere.
  colorById: Map<string, string>
  selectedDay: number | null
  onSelectDay: (day: number | null) => void
  selectedTaskId: string | null
  onSelectTask: (id: string | null) => void
}) {
  const [hovered, setHovered] = useState<string | null>(null)

  const colorOf = (id: string) => colorById.get(id) ?? TASK_COLORS[0]

  // Currently displayed list (respects the day filter).
  const view = useMemo(
    () => taskBreakdown(tasks, sessions, weekStart, weekEnd, selectedDay),
    [tasks, sessions, weekStart, weekEnd, selectedDay],
  )

  // Single-task drill-down (always spans the full week, regardless of day filter).
  const detail = useMemo(
    () => (selectedTaskId ? taskDetail(selectedTaskId, tasks, sessions, weekStart, weekEnd) : null),
    [selectedTaskId, tasks, sessions, weekStart, weekEnd],
  )

  const dayLabel = selectedDay != null ? AR_DAYS[selectedDay] : null
  const hasDay = selectedDay != null
  const dayEmpty = view.perTask.length === 0 || view.totalSeconds === 0

  // One key per view so React remounts (and fades in) on each change — no exit-wait,
  // so a state swap is never blocked by an in-flight animation.
  const viewKey = detail
    ? `detail:${detail.id}`
    : !hasDay
      ? 'prompt'
      : dayEmpty
        ? `zero:${selectedDay}`
        : `list:${selectedDay}`

  return (
    <div className="glass rounded-3xl p-5 mb-4">
      {/* Header — back-path in detail view, day chip when a day is chosen, plain otherwise */}
      <div className="flex items-center gap-2 mb-4 min-h-9">
        {detail ? (
          <button
            onClick={() => onSelectTask(null)}
            className="flex items-center gap-2 focus-ring rounded-xl -mr-1 px-1.5 py-1 text-ink-300 hover:text-ink-100 transition-colors"
            aria-label="رجوع إلى قائمة اليوم"
          >
            <ArrowRight size={18} weight="bold" />
            <span className="text-sm">
              {dayLabel ? `مهام يوم ${dayLabel}` : 'الوقت لكل مهمة'}
            </span>
          </button>
        ) : (
          <>
            <span className="grid place-items-center h-8 w-8 rounded-xl bg-accent-faint text-accent-strong shrink-0">
              <Clock size={18} weight="fill" />
            </span>
            <h3 className="font-semibold tracking-tight">الوقت لكل مهمة</h3>
            {dayLabel && (
              <button
                onClick={() => onSelectDay(null)}
                className="flex items-center gap-1 rounded-full bg-accent-faint text-accent-strong text-xs px-2.5 py-1 focus-ring hover:brightness-110 transition mr-auto"
                aria-label={`إلغاء اختيار يوم ${dayLabel}`}
              >
                <span>{dayLabel}</span>
                <X size={12} weight="bold" />
              </button>
            )}
          </>
        )}
      </div>

      <motion.div key={viewKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
        {detail ? (
          <TaskDetailView detail={detail} color={colorOf(detail.id)} />
        ) : !hasDay ? (
          // Empty by default — nothing shown until a day is picked from the chart.
          <div className="flex flex-col items-center text-center gap-2 py-8">
            <span className="grid place-items-center h-11 w-11 rounded-2xl bg-white/[0.04] text-ink-400">
              <CursorClick size={22} weight="duotone" />
            </span>
            <p className="text-sm text-ink-300 max-w-[15rem]">
              اختر يوماً من مخطط «الوقت لكل يوم» بالأعلى لعرض المهام التي عملت عليها فيه.
            </p>
          </div>
        ) : dayEmpty ? (
          // Zero state — a day is selected but has no logged work.
          <div className="flex flex-col items-center text-center gap-1 py-7">
            <p className="text-5xl font-bold text-ink-500 nums leading-none">٠</p>
            <p className="text-sm text-ink-200 mt-1">لا وقت مسجّل يوم {dayLabel}</p>
            <p className="text-xs text-ink-500">لم تعمل على أي مهمة في هذا اليوم.</p>
          </div>
        ) : (
          <div>
            {/* Day total */}
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-sm text-ink-400">
                إجمالي يوم <span className="text-ink-200 font-medium">{dayLabel}</span>
              </p>
              <p className="nums text-lg font-semibold text-accent-strong">{fmtDurationAr(view.totalSeconds)}</p>
            </div>

            {/* Segmented bar — each task a colored segment sized by its share of the day */}
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-white/[0.04]" dir="rtl">
              {view.perTask.map((t) => {
                const pct = (t.seconds / view.totalSeconds) * 100
                const dim = hovered != null && hovered !== t.id
                return (
                  <button
                    key={t.id}
                    title={`${t.title} — ${fmtDurationAr(t.seconds)} (${Math.round(pct)}%)`}
                    aria-label={`${t.title}: ${fmtDurationAr(t.seconds)}`}
                    onClick={() => onSelectTask(t.id)}
                    onMouseEnter={() => setHovered(t.id)}
                    onMouseLeave={() => setHovered(null)}
                    className="h-full transition-opacity duration-150 cursor-pointer"
                    style={{
                      width: `${pct}%`,
                      minWidth: pct > 0 ? 4 : 0,
                      background: colorOf(t.id),
                      opacity: dim ? 0.3 : 1,
                    }}
                  />
                )
              })}
            </div>

            {/* Task list — each row opens that task's detail */}
            <ul className="mt-3 space-y-1">
              {view.perTask.map((t) => {
                const pct = (t.seconds / view.totalSeconds) * 100
                const dim = hovered != null && hovered !== t.id
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => onSelectTask(t.id)}
                      onMouseEnter={() => setHovered(t.id)}
                      onMouseLeave={() => setHovered(null)}
                      className="w-full flex items-center gap-2.5 text-sm rounded-xl px-2.5 py-2.5 min-h-11 hover:bg-white/[0.05] focus-ring transition-all duration-150"
                      style={{ opacity: dim ? 0.4 : 1 }}
                    >
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ background: colorOf(t.id) }} />
                      <span className="flex-1 text-ink-200 truncate text-right">{t.title}</span>
                      <span className="text-ink-300 nums shrink-0">{fmtDurationAr(t.seconds)}</span>
                      <span className="text-[11px] text-ink-500 nums shrink-0 w-9 text-left">{Math.round(pct)}%</span>
                      <CaretLeft size={14} weight="bold" className="text-ink-500 shrink-0" />
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="text-[11px] text-ink-500 mt-2 px-2">اضغط على أي مهمة لعرض تفاصيل وقتها عبر الأيام.</p>
          </div>
        )}
      </motion.div>
    </div>
  )
}

function TaskDetailView({
  detail,
  color,
}: {
  detail: ReturnType<typeof taskDetail>
  color: string
}) {
  const maxDay = Math.max(...detail.perDay.map((d) => d.seconds), 1)
  const activeDays = detail.perDay.filter((d) => d.seconds > 0).length

  return (
    <div>
      {/* Hero — task title + prominent weekly total, tinted with the task's color */}
      <div
        className="rounded-2xl p-4 mb-5 border"
        style={{ background: `${color}14`, borderColor: `${color}33` }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="h-3 w-3 rounded-full shrink-0" style={{ background: color }} />
          <p className="font-semibold text-ink-100 truncate">{detail.title}</p>
        </div>
        <p className="nums text-3xl font-bold leading-none" style={{ color }}>
          {fmtDurationAr(detail.totalSeconds)}
        </p>
        <p className="text-xs text-ink-400 mt-2">
          الإجمالي هذا الأسبوع · على مدى <span className="text-ink-200 nums">{activeDays}</span> يوم ·{' '}
          <span className="text-ink-200 nums">{detail.sessions.length}</span> جلسة
        </p>
      </div>

      {detail.totalSeconds === 0 ? (
        <p className="text-sm text-ink-400">لا وقت مسجّل على هذه المهمة في هذا الأسبوع.</p>
      ) : (
        <>
          {/* Per-day distribution — which days */}
          <h4 className="text-xs font-medium text-ink-400 mb-2.5">التوزيع على الأيام</h4>
          <div className="space-y-2 mb-5">
            {detail.perDay.map((d) => {
              const has = d.seconds > 0
              return (
                <div key={d.dayIndex} className="flex items-center gap-2.5 text-sm">
                  <span className={`w-12 shrink-0 ${has ? 'text-ink-200' : 'text-ink-500'}`}>{d.day}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-white/[0.04] overflow-hidden" dir="rtl">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${(d.seconds / maxDay) * 100}%`, background: color, opacity: has ? 1 : 0 }}
                    />
                  </div>
                  <span className={`w-16 shrink-0 text-left nums ${has ? 'text-ink-100' : 'text-ink-500'}`}>
                    {has ? fmtDurationAr(d.seconds) : '—'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Individual sessions — when */}
          <h4 className="text-xs font-medium text-ink-400 mb-2.5">الجلسات ({detail.sessions.length})</h4>
          <ul className="space-y-1 max-h-56 overflow-y-auto -mr-1 pr-1">
            {detail.sessions.map((s, i) => (
              <li
                key={i}
                className="flex items-center gap-2.5 text-sm rounded-lg px-2 py-1.5 bg-white/[0.02]"
              >
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="flex-1 text-ink-300 nums">
                  {fmtDate(s.at)} · {fmtTime(s.at)}
                </span>
                <span className="shrink-0 nums text-ink-100">{fmtDurationAr(s.seconds)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  accent,
  small,
  index = 0,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: boolean
  small?: boolean
  index?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: 'easeOut' }}
      className="glass-soft rounded-2xl p-4"
    >
      <span className={`grid place-items-center h-9 w-9 rounded-xl mb-3 ${accent ? 'bg-accent text-ink-950' : 'bg-white/[0.06] text-ink-300'}`}>
        {icon}
      </span>
      <p className={`font-semibold text-ink-100 ${small ? 'text-lg' : 'nums text-2xl'}`}>{value}</p>
      <p className="text-xs text-ink-400 mt-0.5">{label}</p>
    </motion.div>
  )
}
