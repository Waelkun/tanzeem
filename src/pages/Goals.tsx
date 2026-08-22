import { useMemo, useState } from 'react'
import { DotsThreeVertical, PencilSimple, Plus, Target, TrashSimple } from '@phosphor-icons/react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { AnimatePresence, motion } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { GoalForm } from '@/features/goals/GoalForm'
import { TaskItem } from '@/features/tasks/TaskItem'
import { TaskForm } from '@/features/tasks/TaskForm'
import { useDeleteGoal, useGoalProgress, useGoals, useTasks } from '@/lib/queries'
import { useTimerControls } from '@/features/timer/useTimerControls'
import { fmtHours } from '@/lib/dates'
import type { Goal, GoalProgress, Task } from '@/lib/types'

export default function Goals() {
  const { data: goals, isLoading, isError, refetch } = useGoals()
  const { data: progress } = useGoalProgress()
  const del = useDeleteGoal()
  const [formOpen, setFormOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [openGoal, setOpenGoal] = useState<Goal | null>(null)

  const openNew = () => {
    setEditingGoal(null)
    setFormOpen(true)
  }
  const openEdit = (g: Goal) => {
    setEditingGoal(g)
    setFormOpen(true)
  }

  const progressById = useMemo(
    () => new Map((progress ?? []).map((p) => [p.goal_id, p])),
    [progress],
  )

  return (
    <div>
      <PageHeader
        title="الأهداف"
        subtitle="تابع تقدّمك نحو ما يهمّك — اضغط هدفاً لعرض مهامه"
        action={
          <Button variant="primary" size="sm" onClick={openNew}>
            <Plus size={18} weight="bold" />
            <span className="hidden sm:inline">هدف</span>
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-soft rounded-3xl p-5 h-40 skeleton" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (goals ?? []).length === 0 ? (
        <EmptyState
          icon={Target}
          title="لا توجد أهداف بعد"
          hint="حدّد هدفاً واربط مهامك به لتتبع تقدّمك بالساعات ونسبة الإنجاز"
          action={{ label: 'إنشاء هدف', onClick: openNew }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals!.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              progress={progressById.get(g.id)}
              onOpen={() => setOpenGoal(g)}
              onEdit={() => openEdit(g)}
              onDelete={() => del.mutate(g.id)}
            />
          ))}
        </div>
      )}

      <GoalForm open={formOpen} onOpenChange={setFormOpen} goal={editingGoal} />
      <GoalDetailModal goal={openGoal} onClose={() => setOpenGoal(null)} />
    </div>
  )
}

function GoalCard({
  goal,
  progress,
  onOpen,
  onEdit,
  onDelete,
}: {
  goal: Goal
  progress?: GoalProgress
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { title, description, color, target_hours: targetHours } = goal
  const accumulated = progress?.accumulated_hours ?? 0
  const tasksPct = progress?.tasks_percent ?? 0
  const hoursPct = targetHours > 0 ? Math.min(100, (accumulated / targetHours) * 100) : 0
  // Ring shows hours progress when a target exists, otherwise task completion.
  const ringPct = targetHours > 0 ? hoursPct : tasksPct

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl p-5"
    >
      <div className="flex items-start gap-4">
        <ProgressRing value={ringPct} color={color} size={84} stroke={7}>
          <div className="text-center">
            <span className="nums text-lg font-semibold" style={{ color }}>
              {Math.round(ringPct)}
            </span>
            <span className="text-[10px] text-ink-400 block -mt-0.5">%</span>
          </div>
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button onClick={onOpen} className="text-start min-w-0 flex-1 focus-ring rounded-lg">
              <h3 className="font-semibold text-ink-100 leading-snug hover:text-accent-strong transition-colors">
                {title}
              </h3>
            </button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="shrink-0 grid place-items-center h-8 w-8 rounded-lg text-ink-400 hover:bg-white/[0.08] transition-colors focus-ring">
                  <DotsThreeVertical size={18} weight="bold" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={6} className="glass rounded-2xl p-1.5 min-w-40 z-50 text-sm">
                  <DropdownMenu.Item
                    onSelect={onEdit}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer outline-none text-ink-200 data-[highlighted]:bg-white/[0.08]"
                  >
                    <PencilSimple size={16} />
                    تعديل الهدف
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={onDelete}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer outline-none text-priority-high data-[highlighted]:bg-priority-high/15"
                  >
                    <TrashSimple size={16} />
                    حذف الهدف
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>

          {description && <p className="text-xs text-ink-400 mt-1 line-clamp-2">{description}</p>}

          <button onClick={onOpen} className="text-start focus-ring rounded-lg mt-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {targetHours > 0 && (
                <span className="text-ink-300">
                  <span className="nums text-ink-100">{fmtHours(accumulated)}</span>
                  <span className="text-ink-500"> / {fmtHours(targetHours)}</span>
                </span>
              )}
              <span className="text-ink-300">
                المهام: <span className="nums text-ink-100">{progress?.done_tasks ?? 0}</span>
                <span className="text-ink-500">/{progress?.total_tasks ?? 0}</span>
              </span>
              <span className="text-accent-strong">عرض المهام ←</span>
            </div>
          </button>
        </div>
      </div>
    </motion.div>
  )
}

/** Lists the tasks assigned to a goal, with a shortcut to add another. */
function GoalDetailModal({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const { data: tasks } = useTasks()
  const { start } = useTimerControls()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)

  const goalTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.goal_id === goal?.id),
    [tasks, goal],
  )
  const active = goalTasks.filter((t) => t.status !== 'done')
  const done = goalTasks.filter((t) => t.status === 'done')

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }

  return (
    <>
      <Modal
        open={!!goal}
        onOpenChange={(o) => !o && onClose()}
        title={goal?.title}
        description={
          goalTasks.length > 0
            ? `${done.length} مكتملة من ${goalTasks.length} مهمة مرتبطة`
            : 'لا مهام مرتبطة بهذا الهدف بعد'
        }
      >
        {goal && (
          <div className="space-y-4">
            <Button variant="soft" size="sm" onClick={openNew} className="w-full">
              <Plus size={16} weight="bold" />
              أضف مهمة لهذا الهدف
            </Button>

            {goalTasks.length === 0 ? (
              <p className="text-sm text-ink-400 text-center py-6">
                اربط مهامك بهذا الهدف لتتبّع تقدّمك — إمّا من هنا أو باختيار الهدف عند إنشاء مهمة.
              </p>
            ) : (
              <div className="space-y-4">
                {active.length > 0 && (
                  <div className="space-y-2.5">
                    <p className="text-xs font-medium text-ink-400">النشطة ({active.length})</p>
                    <AnimatePresence initial={false}>
                      {active.map((t) => (
                        <TaskItem
                          key={t.id}
                          task={t}
                          goal={goal}
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
                {done.length > 0 && (
                  <div className="space-y-2.5">
                    <p className="text-xs font-medium text-ink-400">المكتملة ({done.length})</p>
                    <AnimatePresence initial={false}>
                      {done.map((t) => (
                        <TaskItem
                          key={t.id}
                          task={t}
                          goal={goal}
                          onEdit={(task) => {
                            setEditing(task)
                            setFormOpen(true)
                          }}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <TaskForm open={formOpen} onOpenChange={setFormOpen} task={editing} defaultGoalId={goal?.id ?? null} />
    </>
  )
}
