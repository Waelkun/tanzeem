import { memo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowsClockwise,
  Check,
  DotsThreeVertical,
  PencilSimple,
  Play,
  TrashSimple,
  Trophy,
} from '@phosphor-icons/react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { vibrate } from '@/lib/alerts'
import { dueLabel } from '@/lib/dates'
import { nextOccurrencePatch } from '@/lib/recurrence'
import { bigCelebrate } from '@/lib/celebrate'
import { useAddAchievement, useDeleteTask, useUpdateTask } from '@/lib/queries'
import { PRIORITY_COLORS, PRIORITY_LABELS, RECURRENCE_LABELS, type Goal, type Task } from '@/lib/types'
import { cn } from '@/lib/cn'

interface Props {
  task: Task
  goal?: Goal
  onEdit: (task: Task) => void
  onStartTimer?: (task: Task) => void
}

function TaskItemBase({ task, goal, onEdit, onStartTimer }: Props) {
  const update = useUpdateTask()
  const del = useDeleteTask()
  const addAchievement = useAddAchievement()
  const ref = useRef<HTMLDivElement>(null)
  const done = task.status === 'done'
  const due = dueLabel(task.due_date)

  // Opt-in: promote a task into the achievements log (they stay separate systems).
  const promoteToAchievement = () => {
    addAchievement.mutate({ text: task.title, task_id: task.id })
    bigCelebrate()
    vibrate([30, 30, 60])
  }

  const toggle = () => {
    if (!done) {
      bigCelebrate()
      vibrate(30)
      if (task.recurrence !== 'none') {
        // Recurring: roll forward to the next occurrence instead of ending it.
        update.mutate({ id: task.id, patch: nextOccurrencePatch(task) })
      } else {
        update.mutate({ id: task.id, patch: { status: 'done', completed_at: new Date().toISOString() } })
      }
    } else {
      update.mutate({ id: task.id, patch: { status: 'todo', completed_at: null } })
    }
  }

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="glass-soft rounded-2xl p-3.5 flex items-start gap-3 group"
    >
      <button
        onClick={toggle}
        aria-label={done ? 'إلغاء الإكمال' : 'إكمال المهمة'}
        className={cn(
          'relative mt-0.5 grid place-items-center h-6 w-6 rounded-full border-2 shrink-0 transition-colors active:scale-90 focus-ring',
          done ? 'bg-accent border-accent text-ink-950' : 'border-ink-500 hover:border-accent',
        )}
      >
        <AnimatePresence>
          {done && (
            <motion.span
              key="check"
              initial={{ scale: 0, rotate: -35 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 18 }}
            >
              <Check size={14} weight="bold" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <button onClick={() => onEdit(task)} className="min-w-0 flex-1 text-start">
        <p className={cn('text-sm leading-snug transition-colors', done ? 'text-ink-500 line-through' : 'text-ink-100')}>
          {task.title}
        </p>
        {task.notes && !done && (
          <p className="text-xs text-ink-400 mt-1 line-clamp-1">{task.notes.replace(/[#*_`>]/g, '')}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span
            className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md"
            style={{ color: PRIORITY_COLORS[task.priority], background: `${PRIORITY_COLORS[task.priority]}1a` }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIORITY_COLORS[task.priority] }} />
            {PRIORITY_LABELS[task.priority]}
          </span>
          {goal && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-md" style={{ color: goal.color, background: `${goal.color}1a` }}>
              {goal.title}
            </span>
          )}
          {task.category && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-ink-300">{task.category}</span>
          )}
          {task.recurrence !== 'none' && (
            <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-ink-300">
              <ArrowsClockwise size={11} />
              {RECURRENCE_LABELS[task.recurrence]}
            </span>
          )}
          {due && (
            <span className={cn('text-[11px] px-1.5 py-0.5 rounded-md', due.overdue && !done ? 'bg-priority-high/15 text-priority-high' : 'bg-white/[0.06] text-ink-300')}>
              {due.text}
            </span>
          )}
        </div>
      </button>

      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={promoteToAchievement}
          disabled={addAchievement.isPending}
          aria-label="سجّل كإنجاز"
          title="سجّل كإنجاز"
          className="grid place-items-center h-8 w-8 rounded-lg text-accent-strong hover:bg-accent-faint transition-colors focus-ring active:scale-90 disabled:opacity-50"
        >
          <Trophy size={17} weight="fill" />
        </button>
        <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            aria-label="خيارات"
            className="shrink-0 grid place-items-center h-8 w-8 rounded-lg text-ink-400 hover:bg-white/[0.08] hover:text-ink-100 transition-colors focus-ring opacity-60 group-hover:opacity-100"
          >
            <DotsThreeVertical size={18} weight="bold" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="glass rounded-2xl p-1.5 min-w-44 z-50 text-sm"
          >
            {onStartTimer && !done && (
              <MenuItem onSelect={() => onStartTimer(task)} icon={<Play size={16} weight="fill" />}>
                بدء مؤقّت
              </MenuItem>
            )}
            <MenuItem onSelect={() => onEdit(task)} icon={<PencilSimple size={16} />}>
              تعديل
            </MenuItem>
            <MenuItem onSelect={() => del.mutate(task.id)} icon={<TrashSimple size={16} />} danger>
              حذف
            </MenuItem>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </motion.div>
  )
}

function MenuItem({
  children,
  onSelect,
  icon,
  danger,
}: {
  children: React.ReactNode
  onSelect: () => void
  icon: React.ReactNode
  danger?: boolean
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer outline-none transition-colors',
        danger ? 'text-priority-high data-[highlighted]:bg-priority-high/15' : 'text-ink-200 data-[highlighted]:bg-white/[0.08]',
      )}
    >
      {icon}
      {children}
    </DropdownMenu.Item>
  )
}

export const TaskItem = memo(TaskItemBase)
