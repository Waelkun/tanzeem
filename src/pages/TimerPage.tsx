import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Coffee, Pause, PencilSimple, Play, Stop, Timer as TimerIcon, TrashSimple } from '@phosphor-icons/react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/form'
import { Segmented } from '@/components/ui/form'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/states'
import { useDeleteSession, useSessions, useTasks } from '@/lib/queries'
import { useTimerControls } from '@/features/timer/useTimerControls'
import { useTick } from '@/features/timer/useTick'
import { SessionEditModal } from '@/features/timer/SessionEditModal'
import { elapsedSeconds, phaseTargetSeconds, useTimerStore } from '@/store/timerStore'
import { fmtDuration, fmtDateTime } from '@/lib/dates'
import type { Session, SessionMode } from '@/lib/types'

const PHASE_LABEL = { focus: 'تركيز', break: 'استراحة', longbreak: 'استراحة طويلة' } as const

export default function TimerPage() {
  const { data: tasks } = useTasks()
  const { data: sessions } = useSessions(30)
  const store = useTimerStore()
  const { start, pause, resume, stop } = useTimerControls()
  useTick(store.status === 'running')
  const del = useDeleteSession()
  const [editing, setEditing] = useState<Session | null>(null)
  const [deleting, setDeleting] = useState<Session | null>(null)

  const activeTasks = (tasks ?? []).filter((t) => t.status !== 'done')
  const tasksById = useMemo(() => new Map((tasks ?? []).map((t) => [t.id, t.title])), [tasks])

  const secs = elapsedSeconds(store)
  const isPomo = store.mode === 'pomodoro'
  const target = isPomo ? phaseTargetSeconds(store.phase, store.config) : 0
  const remaining = isPomo ? Math.max(0, target - secs) : 0
  const pct = isPomo && target > 0 ? Math.min(100, (secs / target) * 100) : store.status === 'idle' ? 0 : 100
  const idle = store.status === 'idle'

  const ringColor = !isPomo || store.phase === 'focus' ? '#34b98a' : '#5a9bd4'

  return (
    <div>
      <PageHeader title="المؤقّت" subtitle="ركّز على مهمة واحدة في كل مرة" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
        {/* Timer card */}
        <div className="glass rounded-3xl p-6 flex flex-col items-center">
          {/* Mode + task pickers (only when idle) */}
          {idle ? (
            <div className="w-full space-y-3 mb-6">
              <Segmented<SessionMode>
                value={store.mode}
                onChange={(m) => useTimerStore.setState({ mode: m })}
                options={[
                  { value: 'timer', label: 'مؤقّت حر' },
                  { value: 'pomodoro', label: 'بومودورو' },
                ]}
              />
              <Select
                value={store.taskId ?? ''}
                onChange={(e) =>
                  useTimerStore.setState({
                    taskId: e.target.value || null,
                    taskTitle: e.target.value ? tasksById.get(e.target.value) ?? null : null,
                  })
                }
              >
                <option value="">بدون مهمة محددة</option>
                {activeTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="mb-6 text-center">
              <span
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full ${
                  isPomo && store.phase !== 'focus' ? 'bg-priority-low/15 text-priority-low' : 'bg-accent-faint text-accent-strong'
                }`}
              >
                {isPomo && store.phase !== 'focus' ? <Coffee size={14} weight="fill" /> : <TimerIcon size={14} weight="fill" />}
                {isPomo ? PHASE_LABEL[store.phase] : 'جلسة حرة'}
              </span>
              <p className="text-sm text-ink-300 mt-2">{store.taskTitle ?? 'جلسة عمل'}</p>
            </div>
          )}

          {/* Ring + time */}
          <ProgressRing value={pct} color={ringColor} size={220} stroke={12}>
            <div className="text-center">
              <p className="nums text-4xl font-bold text-ink-100">
                {fmtDuration(isPomo && !idle ? remaining : secs)}
              </p>
              {isPomo && (
                <p className="text-xs text-ink-500 mt-1">
                  دورة <span className="nums">{store.completedFocus + (store.phase === 'focus' ? 1 : 0)}</span> /{' '}
                  <span className="nums">{store.config.cycles}</span>
                </p>
              )}
            </div>
          </ProgressRing>

          {/* Controls */}
          <div className="flex items-center gap-3 mt-8">
            {idle ? (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => start(store.taskId, store.taskTitle, store.mode)}
                className="inline-flex items-center gap-2 h-14 px-8 rounded-2xl bg-accent text-ink-950 font-semibold shadow-[0_10px_30px_-8px_rgba(52,185,138,0.6)] focus-ring"
              >
                <Play size={22} weight="fill" />
                ابدأ
              </motion.button>
            ) : (
              <>
                {store.status === 'running' ? (
                  <ControlBtn onClick={pause} label="إيقاف مؤقت">
                    <Pause size={24} weight="fill" />
                  </ControlBtn>
                ) : (
                  <ControlBtn onClick={resume} label="متابعة" primary>
                    <Play size={24} weight="fill" />
                  </ControlBtn>
                )}
                <ControlBtn onClick={stop} label="إنهاء" danger>
                  <Stop size={24} weight="fill" />
                </ControlBtn>
              </>
            )}
          </div>
        </div>

        {/* Session history */}
        <div className="glass rounded-3xl p-5">
          <h3 className="font-semibold tracking-tight mb-4">آخر الجلسات</h3>
          {(sessions ?? []).length === 0 ? (
            <EmptyState icon={TimerIcon} title="لا جلسات بعد" hint="ابدأ مؤقّتاً لتسجيل أول جلسة" />
          ) : (
            <div className="space-y-2">
              {sessions!.map((s) => (
                <div key={s.id} className="flex items-center gap-3 glass-soft rounded-2xl px-3.5 py-2.5 group">
                  <span
                    className={`grid place-items-center h-9 w-9 rounded-xl shrink-0 ${
                      s.mode === 'pomodoro' ? 'bg-priority-low/15 text-priority-low' : 'bg-accent-faint text-accent-strong'
                    }`}
                  >
                    {s.mode === 'pomodoro' ? <Coffee size={16} weight="fill" /> : <TimerIcon size={16} weight="fill" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{s.task_id ? tasksById.get(s.task_id) ?? 'مهمة محذوفة' : 'جلسة حرة'}</p>
                    <p className="text-[11px] text-ink-500">{fmtDateTime(s.started_at)}</p>
                  </div>
                  <span className="nums text-sm text-ink-200 shrink-0">{fmtDuration(s.duration_seconds)}</span>
                  <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditing(s)}
                      aria-label="تعديل الجلسة"
                      title="تعديل"
                      className="grid place-items-center h-8 w-8 rounded-lg text-ink-400 hover:bg-white/[0.08] hover:text-ink-100 transition-colors focus-ring active:scale-90"
                    >
                      <PencilSimple size={16} />
                    </button>
                    <button
                      onClick={() => setDeleting(s)}
                      aria-label="حذف الجلسة"
                      title="حذف"
                      className="grid place-items-center h-8 w-8 rounded-lg text-priority-high hover:bg-priority-high/15 transition-colors focus-ring active:scale-90"
                    >
                      <TrashSimple size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <SessionEditModal
        session={editing}
        tasks={tasks ?? []}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      />

      <Modal
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="حذف الجلسة؟"
        description="سيُحذف هذا الوقت من إحصائياتك ولا يمكن التراجع."
      >
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            إلغاء
          </Button>
          <Button
            variant="danger"
            disabled={del.isPending}
            onClick={() => {
              if (!deleting) return
              del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
            }}
          >
            {del.isPending ? 'جارٍ الحذف…' : 'حذف'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function ControlBtn({
  children,
  onClick,
  label,
  primary,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  primary?: boolean
  danger?: boolean
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      aria-label={label}
      className={`grid place-items-center h-14 w-14 rounded-2xl focus-ring transition-colors ${
        danger
          ? 'bg-priority-high/15 text-priority-high hover:bg-priority-high/25'
          : primary
            ? 'bg-accent text-ink-950'
            : 'glass-soft text-ink-100 hover:bg-white/[0.08]'
      }`}
    >
      {children}
    </motion.button>
  )
}
