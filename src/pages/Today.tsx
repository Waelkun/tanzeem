import { useMemo, useState } from 'react'
import { isPast, isToday, parseISO } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarCheck, Clock, Fire, ListChecks, Plus, Sparkle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/form'
import { SkeletonList } from '@/components/ui/states'
import { TaskItem } from '@/features/tasks/TaskItem'
import { TaskForm } from '@/features/tasks/TaskForm'
import { AchievementBox } from '@/features/achievements/AchievementBox'
import { DailyPlanModal } from '@/features/ai/DailyPlanModal'
import { useCreateTask, useGoals, useSessions, useTasks } from '@/lib/queries'
import { useTimerControls } from '@/features/timer/useTimerControls'
import { computeStreak, tasksDoneToday, todaySeconds } from '@/lib/stats'
import { fmtDuration, fmtDate } from '@/lib/dates'
import type { Task } from '@/lib/types'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'صباح الخير'
  if (h < 17) return 'مساء الخير'
  return 'مساء الخير'
}

export default function Today({ onOpenAI }: { onOpenAI: () => void }) {
  const { data: tasks, isLoading } = useTasks()
  const { data: goals } = useGoals()
  const { data: sessions } = useSessions()
  const { start } = useTimerControls()
  const create = useCreateTask()

  const [editing, setEditing] = useState<Task | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [quick, setQuick] = useState('')

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const quickAdd = () => {
    const title = quick.trim()
    if (!title) return
    // Default the due date to end of today (local) so the task appears in the
    // "تركيز اليوم" list right away — a bare title with no date would be filtered out.
    const now = new Date()
    const dueToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59).toISOString()
    create.mutate({ title, due_date: dueToday })
    setQuick('')
  }

  const goalsById = useMemo(() => new Map((goals ?? []).map((g) => [g.id, g])), [goals])

  const todayTasks = useMemo(() => {
    const list = (tasks ?? []).filter((t) => t.status !== 'done')
    const relevant = list.filter((t) => {
      const due = t.due_date ? parseISO(t.due_date) : null
      const sched = t.scheduled_start ? parseISO(t.scheduled_start) : null
      return (due && (isToday(due) || isPast(due))) || (sched && isToday(sched))
    })
    return relevant.sort((a, b) => {
      const at = a.due_date ?? a.scheduled_start ?? ''
      const bt = b.due_date ?? b.scheduled_start ?? ''
      return at.localeCompare(bt)
    })
  }, [tasks])

  const secs = todaySeconds(sessions ?? [])
  const doneToday = tasksDoneToday(tasks ?? [])
  const streak = computeStreak(tasks ?? [], sessions ?? [])

  return (
    <div>
      {/* Hero — left aligned, not centered */}
      <div className="mb-7">
        <p className="text-sm text-accent-strong font-medium">{fmtDate(new Date())}</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">{greeting()}</h1>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatTile index={0} icon={<Clock size={18} weight="fill" />} label="وقت اليوم" value={fmtDuration(secs)} accent />
        <StatTile index={1} icon={<ListChecks size={18} weight="fill" />} label="مهام أُنجزت" value={String(doneToday)} />
        <StatTile index={2} icon={<Fire size={18} weight="fill" />} label="سلسلة الأيام" value={`${streak}`} suffix="يوم" />
        <StatTile index={3} icon={<CalendarCheck size={18} weight="fill" />} label="مهام اليوم" value={String(todayTasks.length)} />

        {/* AI daily plan CTA — wide */}
        <motion.button
          whileTap={{ scale: 0.99 }}
          onClick={() => setPlanOpen(true)}
          className="col-span-2 lg:col-span-4 glass rounded-3xl p-5 text-start hover:bg-white/[0.04] transition-colors group relative overflow-hidden"
        >
          <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-accent/10 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <span className="grid place-items-center h-12 w-12 rounded-2xl bg-accent text-ink-950 shrink-0 shadow-[0_8px_20px_-8px_rgba(52,185,138,0.6)]">
              <Sparkle size={24} weight="fill" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold tracking-tight">خطة اليوم الذكية</p>
              <p className="text-sm text-ink-400 mt-0.5">دع المساعد يرتّب مهامك حسب وقتك وإنتاجيتك السابقة</p>
            </div>
            <span className="text-accent-strong text-sm shrink-0 hidden sm:block group-hover:translate-x-[-4px] transition-transform">
              أنشئ الخطة ←
            </span>
          </div>
        </motion.button>
      </div>

      {/* Two-column: focus list + side */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 mt-4">
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-semibold tracking-tight">تركيز اليوم</h2>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="ghost" size="sm" onClick={onOpenAI}>
                <Sparkle size={16} weight="fill" className="text-accent-strong" />
                <span className="hidden sm:inline">اسأل المساعد</span>
              </Button>
              <Button variant="primary" size="sm" onClick={openNew}>
                <Plus size={16} weight="bold" />
                مهمة
              </Button>
            </div>
          </div>

          {/* Quick add */}
          <div className="flex gap-2 mb-4">
            <Input
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && quickAdd()}
              placeholder="أضف مهمة سريعة ثم اضغط Enter…"
            />
            <Button variant="soft" onClick={quickAdd} disabled={!quick.trim()}>
              إضافة
            </Button>
          </div>

          {isLoading ? (
            <SkeletonList rows={3} />
          ) : todayTasks.length === 0 ? (
            <div className="text-center py-10">
              <div className="grid place-items-center h-14 w-14 rounded-2xl bg-accent-faint text-accent mx-auto mb-3">
                <CalendarCheck size={26} weight="duotone" />
              </div>
              <p className="text-ink-200 font-medium">لا مهام مستحقّة اليوم</p>
              <p className="text-sm text-ink-400 mt-1">استمتع بيومك أو أضف مهمة جديدة</p>
              <Button variant="soft" size="sm" className="mt-4" onClick={openNew}>
                <Plus size={16} weight="bold" />
                إضافة مهمة
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <AnimatePresence initial={false}>
                {todayTasks.map((t) => (
                  <TaskItem
                    key={t.id}
                    task={t}
                    goal={t.goal_id ? goalsById.get(t.goal_id) : undefined}
                    onEdit={(task) => {
                      setEditing(task)
                      setFormOpen(true)
                    }}
                    onStartTimer={(task) => start(task.id, task.title, 'timer')}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <AchievementBox />
      </div>

      <TaskForm open={formOpen} onOpenChange={setFormOpen} task={editing} />
      <DailyPlanModal open={planOpen} onOpenChange={setPlanOpen} />
    </div>
  )
}

function StatTile({
  icon,
  label,
  value,
  suffix,
  accent,
  index = 0,
}: {
  icon: React.ReactNode
  label: string
  value: string
  suffix?: string
  accent?: boolean
  index?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: 'easeOut' }}
      className="glass-soft rounded-3xl p-4"
    >
      <span className={`grid place-items-center h-9 w-9 rounded-xl mb-3 ${accent ? 'bg-accent text-ink-950' : 'bg-white/[0.06] text-ink-300'}`}>
        {icon}
      </span>
      <p className="nums text-2xl font-semibold text-ink-100">
        {value}
        {suffix && <span className="text-sm text-ink-400 font-normal me-1"> {suffix}</span>}
      </p>
      <p className="text-xs text-ink-400 mt-0.5">{label}</p>
    </motion.div>
  )
}
