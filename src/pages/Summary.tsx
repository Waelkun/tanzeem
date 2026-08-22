import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { CaretLeft, CaretRight, CheckCircle, Clock, FilePdf, Fire, Sparkle, Trophy } from '@phosphor-icons/react'
import ReactMarkdown from 'react-markdown'
import { motion } from 'framer-motion'
import { addWeeks, isWithinInterval, parseISO } from 'date-fns'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAchievements, useSessions, useTasks } from '@/lib/queries'
import { computeStreak, weekStats } from '@/lib/stats'
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

  // Bars read right-to-left: Monday sits on the right, Sunday on the left.
  const chartData = useMemo(() => [...stats.perDay].reverse(), [stats.perDay])
  const maxSeconds = Math.max(...stats.perDay.map((d) => d.seconds), 1)

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
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold tracking-tight">الوقت لكل يوم</h3>
          {stats.mostProductiveHour != null && (
            <span className="text-xs text-ink-400">
              ذروة التركيز حوالي <span className="nums text-ink-200">{String(stats.mostProductiveHour).padStart(2, '0')}:00</span>
            </span>
          )}
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: '#9494a1', fontSize: 12, fontFamily: 'IBM Plex Sans Arabic' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                contentStyle={{
                  background: '#1d1d22',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 14,
                  padding: '8px 12px',
                  boxShadow: '0 12px 30px -12px rgba(0,0,0,0.7)',
                  fontSize: 13,
                }}
                labelStyle={{ color: '#e6e6ea', fontWeight: 700, marginBottom: 2 }}
                itemStyle={{ color: '#e6e6ea', fontWeight: 600 }}
                formatter={(_v: number, _n, item) => [fmtDurationAr(item?.payload?.seconds ?? 0), 'العمل']}
              />
              <Bar dataKey="seconds" radius={[8, 8, 0, 0]} maxBarSize={40}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.seconds >= maxSeconds && maxSeconds > 0 ? '#34b98a' : 'rgba(52,185,138,0.4)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

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
