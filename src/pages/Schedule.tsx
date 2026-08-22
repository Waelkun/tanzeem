import { useMemo, useState } from 'react'
import { addDays, isSameDay, isToday, parseISO, setHours, startOfDay, startOfWeek } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { CaretLeft, CaretRight, Clock } from '@phosphor-icons/react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { SkeletonList } from '@/components/ui/states'
import { TaskForm } from '@/features/tasks/TaskForm'
import { useCalendarEvents, useTasks, useUpdateTask } from '@/lib/queries'
import { occursOn } from '@/lib/recurrence'
import { fmtDate, fmtWeekday, WEEKDAYS_SHORT_AR } from '@/lib/dates'
import { PRIORITY_COLORS, type Task } from '@/lib/types'
import { cn } from '@/lib/cn'

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6:00 → 23:00

export default function Schedule() {
  const { data: tasks, isLoading } = useTasks()
  const { data: calEvents } = useCalendarEvents()
  const update = useUpdateTask()
  const [day, setDay] = useState(() => startOfDay(new Date()))
  const [selected, setSelected] = useState<Task | null>(null)
  const [editing, setEditing] = useState<Task | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  // Drag-and-drop state (pointer devices; tap-to-place remains the touch fallback).
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverHour, setDragOverHour] = useState<number | null>(null)
  const [dragOverTray, setDragOverTray] = useState(false)

  const weekDays = useMemo(() => {
    const start = startOfWeek(day, { weekStartsOn: 1 }) // Monday — consistent with the Summary week
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [day])

  const active = (tasks ?? []).filter((t) => t.status !== 'done')

  const dayTasks = useMemo(() => active.filter((t) => occursOn(t, day)), [active, day])
  // A task lands on the timeline at its time — whichever exists: an explicit
  // scheduled_start, otherwise its due_date. So setting a due time is enough to
  // see it on the schedule (no manual scheduling needed).
  const scheduledByHour = useMemo(() => {
    const map = new Map<number, Task[]>()
    dayTasks.forEach((t) => {
      const anchorIso = t.scheduled_start ?? t.due_date
      if (!anchorIso) return
      const h = parseISO(anchorIso).getHours()
      map.set(h, [...(map.get(h) ?? []), t])
    })
    return map
  }, [dayTasks])

  // The tray holds only tasks with no time on this day (nothing to place).
  const unscheduled = useMemo(
    () =>
      active.filter((t) => {
        const anchorIso = t.scheduled_start ?? t.due_date
        return !anchorIso || !occursOn(t, day)
      }),
    [active, day],
  )

  // Google busy blocks for the selected day, grouped by starting hour.
  const busyByHour = useMemo(() => {
    const map = new Map<number, { id: string; title: string | null }[]>()
    for (const ev of calEvents ?? []) {
      const s = parseISO(ev.start_at)
      if (!isSameDay(s, day)) continue
      const h = s.getHours()
      map.set(h, [...(map.get(h) ?? []), { id: ev.id, title: ev.title }])
    }
    return map
  }, [calEvents, day])

  // Place a task on the selected day at the given hour (1-hour block).
  const scheduleTaskAt = (taskId: string, hour: number) => {
    const start = setHours(startOfDay(day), hour)
    const end = setHours(startOfDay(day), hour + 1)
    update.mutate({
      id: taskId,
      patch: { scheduled_start: start.toISOString(), scheduled_end: end.toISOString() },
    })
  }

  // Tap-to-place path (works on touch): select a task, then tap an hour.
  const assignToHour = (hour: number) => {
    if (!selected) return
    scheduleTaskAt(selected.id, hour)
    setSelected(null)
  }

  // Clear every time anchor so the task returns to the unscheduled tray.
  const unscheduleTask = (taskId: string) => {
    update.mutate({ id: taskId, patch: { scheduled_start: null, scheduled_end: null, due_date: null } })
  }

  const onTaskDragStart = (taskId: string) => (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(taskId)
  }
  const endDrag = () => {
    setDraggingId(null)
    setDragOverHour(null)
    setDragOverTray(false)
  }
  const dropOnHour = (hour: number) => (e: React.DragEvent) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || draggingId
    if (id) scheduleTaskAt(id, hour)
    endDrag()
  }
  const dropOnTray = (e: React.DragEvent) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || draggingId
    if (id) unscheduleTask(id)
    endDrag()
  }

  return (
    <div>
      <PageHeader title="الجدول" subtitle="نظّم يومك ساعة بساعة" />

      {/* Week strip */}
      <div className="flex items-center gap-1 mb-4">
        <button
          onClick={() => setDay((d) => addDays(d, -7))}
          className="grid place-items-center h-9 w-9 rounded-xl text-ink-400 hover:bg-white/[0.06] transition-colors focus-ring shrink-0"
          aria-label="الأسبوع السابق"
        >
          <CaretRight size={18} />
        </button>
        <div className="grid grid-cols-7 gap-1 flex-1">
          {weekDays.map((d) => {
            const isSel = isSameDay(d, day)
            return (
              <button
                key={d.toISOString()}
                onClick={() => setDay(startOfDay(d))}
                className={cn(
                  'flex flex-col items-center py-2 rounded-2xl transition-colors focus-ring',
                  isSel ? 'bg-accent text-ink-950' : isToday(d) ? 'text-accent-strong hover:bg-white/[0.05]' : 'text-ink-300 hover:bg-white/[0.05]',
                )}
              >
                <span className="text-[10px] opacity-80">{WEEKDAYS_SHORT_AR[d.getDay()]}</span>
                <span className={cn('nums text-base mt-0.5', isSel && 'font-bold')}>{d.getDate()}</span>
              </button>
            )
          })}
        </div>
        <button
          onClick={() => setDay((d) => addDays(d, 7))}
          className="grid place-items-center h-9 w-9 rounded-xl text-ink-400 hover:bg-white/[0.06] transition-colors focus-ring shrink-0"
          aria-label="الأسبوع التالي"
        >
          <CaretLeft size={18} />
        </button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-ink-300">
          {fmtWeekday(day)} • {fmtDate(day)}
        </p>
        {!isToday(day) && (
          <Button variant="ghost" size="sm" onClick={() => setDay(startOfDay(new Date()))}>
            اليوم
          </Button>
        )}
      </div>

      {selected && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-3 mb-3 flex items-center gap-2 border border-accent/30"
        >
          <Clock size={18} className="text-accent-strong shrink-0" />
          <p className="text-sm flex-1">
            اختر ساعة لجدولة: <span className="font-medium">{selected.title}</span>
          </p>
          <button onClick={() => setSelected(null)} className="text-xs text-ink-400 hover:text-ink-100">
            إلغاء
          </button>
        </motion.div>
      )}

      {isLoading ? (
        <SkeletonList rows={6} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-4">
          {/* Timeline */}
          <div className="glass rounded-3xl p-3">
            {HOURS.map((h) => {
              const items = scheduledByHour.get(h) ?? []
              return (
                <button
                  key={h}
                  onClick={() => selected && assignToHour(h)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (dragOverHour !== h) setDragOverHour(h)
                  }}
                  onDragLeave={() => setDragOverHour((cur) => (cur === h ? null : cur))}
                  onDrop={dropOnHour(h)}
                  className={cn(
                    'w-full flex gap-3 items-stretch py-1.5 text-start rounded-xl transition-colors',
                    (selected || draggingId) && 'cursor-pointer',
                    selected && dragOverHour !== h && 'hover:bg-accent-faint',
                    dragOverHour === h && 'bg-accent-faint ring-1 ring-accent/50',
                  )}
                >
                  <span className="nums text-xs text-ink-500 w-12 pt-1.5 shrink-0 text-center">
                    {String(h).padStart(2, '0')}:00
                  </span>
                  <div className="flex-1 min-h-9 border-s border-white/[0.06] ps-3 space-y-1.5 py-1">
                    {(busyByHour.get(h) ?? []).map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded-xl px-3 py-1.5 text-xs text-ink-400 bg-white/[0.04] border-s-2 border-ink-500 flex items-center gap-1.5"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-ink-500 shrink-0" />
                        {ev.title || 'مشغول'} <span className="text-ink-400">• Google</span>
                      </div>
                    ))}
                    {items.map((t) => (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={onTaskDragStart(t.id)}
                        onDragEnd={endDrag}
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditing(t)
                          setFormOpen(true)
                        }}
                        className={cn(
                          'rounded-xl px-3 py-2 text-sm cursor-grab active:cursor-grabbing',
                          draggingId === t.id && 'opacity-50',
                        )}
                        style={{
                          background: `${PRIORITY_COLORS[t.priority]}1f`,
                          borderInlineStart: `3px solid ${PRIORITY_COLORS[t.priority]}`,
                        }}
                      >
                        {t.title}
                      </div>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Unscheduled tray — also a drop zone to unschedule a task */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              if (!dragOverTray) setDragOverTray(true)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverTray(false)
            }}
            onDrop={dropOnTray}
            className={cn(
              'glass rounded-3xl p-4 h-fit transition-colors',
              dragOverTray && draggingId && 'ring-2 ring-accent/60 bg-accent-faint',
            )}
          >
            <h3 className="font-semibold text-sm mb-3">مهام غير مجدولة</h3>
            {unscheduled.length === 0 ? (
              <p className="text-sm text-ink-400 py-4 text-center">كل المهام مجدولة</p>
            ) : (
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {unscheduled.map((t) => (
                    <motion.button
                      key={t.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      draggable
                      onDragStartCapture={onTaskDragStart(t.id)}
                      onDragEndCapture={endDrag}
                      onClick={() => setSelected(selected?.id === t.id ? null : t)}
                      className={cn(
                        'w-full text-start glass-soft rounded-xl px-3 py-2.5 text-sm transition-colors cursor-grab active:cursor-grabbing',
                        draggingId === t.id && 'opacity-50',
                        selected?.id === t.id ? 'ring-1 ring-accent/60 bg-accent-faint' : 'hover:bg-white/[0.06]',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: PRIORITY_COLORS[t.priority] }} />
                        <span className="flex-1 truncate">{t.title}</span>
                      </span>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            )}
            <p className="text-[11px] text-ink-400 mt-3 leading-relaxed">
              اسحب مهمة إلى ساعة في الجدول لجدولتها، واسحبها إلى هنا لإلغاء جدولتها. على الجوال: اضغط مهمة ثم اضغط الساعة.
            </p>
          </div>
        </div>
      )}

      <TaskForm open={formOpen} onOpenChange={setFormOpen} task={editing} />
    </div>
  )
}
