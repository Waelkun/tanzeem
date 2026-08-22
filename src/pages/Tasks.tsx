import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CheckCircle, Plus } from '@phosphor-icons/react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/form'
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/states'
import { TaskItem } from '@/features/tasks/TaskItem'
import { TaskForm } from '@/features/tasks/TaskForm'
import { useCreateTask, useGoals, useTasks } from '@/lib/queries'
import { useTimerControls } from '@/features/timer/useTimerControls'
import type { Task } from '@/lib/types'
import { cn } from '@/lib/cn'

type Filter = 'active' | 'done' | 'all'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'active', label: 'النشطة' },
  { value: 'done', label: 'المكتملة' },
  { value: 'all', label: 'الكل' },
]

export default function Tasks() {
  const { data: tasks, isLoading, isError, refetch } = useTasks()
  const { data: goals } = useGoals()
  const create = useCreateTask()
  const { start } = useTimerControls()

  const [filter, setFilter] = useState<Filter>('active')
  const [category, setCategory] = useState<string | null>(null)
  const [quick, setQuick] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)

  const goalsById = useMemo(() => new Map((goals ?? []).map((g) => [g.id, g])), [goals])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const t of tasks ?? []) if (t.category?.trim()) set.add(t.category.trim())
    return Array.from(set)
  }, [tasks])

  const filtered = useMemo(() => {
    let list = tasks ?? []
    if (filter === 'active') list = list.filter((t) => t.status !== 'done')
    else if (filter === 'done')
      // Newest completion first, oldest last.
      list = list
        .filter((t) => t.status === 'done')
        .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
    if (category) list = list.filter((t) => t.category?.trim() === category)
    return list
  }, [tasks, filter, category])

  const quickAdd = () => {
    const title = quick.trim()
    if (!title) return
    create.mutate({ title })
    setQuick('')
  }

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (t: Task) => {
    setEditing(t)
    setFormOpen(true)
  }

  return (
    <div>
      <PageHeader
        title="المهام"
        subtitle="كل ما عليك إنجازه في مكان واحد"
        action={
          <Button variant="primary" size="sm" onClick={openNew} className="shrink-0">
            <Plus size={18} weight="bold" />
            <span className="hidden sm:inline">مهمة</span>
          </Button>
        }
      />

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

      {/* Filters */}
      <div className="flex gap-1.5 mb-3">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-sm transition-colors focus-ring',
              filter === f.value ? 'bg-accent-faint text-accent-strong font-medium' : 'text-ink-400 hover:bg-white/[0.05]',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          <button
            onClick={() => setCategory(null)}
            className={cn(
              'px-3 py-1 rounded-full text-xs transition-colors focus-ring',
              category === null ? 'bg-white/[0.1] text-ink-100 font-medium' : 'text-ink-400 hover:bg-white/[0.05]',
            )}
          >
            كل الفئات
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(category === c ? null : c)}
              className={cn(
                'px-3 py-1 rounded-full text-xs transition-colors focus-ring',
                category === c ? 'bg-accent-faint text-accent-strong font-medium' : 'text-ink-400 hover:bg-white/[0.05]',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <SkeletonList rows={5} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title={filter === 'done' ? 'لا مهام مكتملة بعد' : 'لا توجد مهام'}
          hint={filter === 'done' ? 'أكمل مهمة لتظهر هنا' : 'ابدأ بإضافة أول مهمة لك'}
          action={filter !== 'done' ? { label: 'إضافة مهمة', onClick: openNew } : undefined}
        />
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {filtered.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                goal={t.goal_id ? goalsById.get(t.goal_id) : undefined}
                onEdit={openEdit}
                onStartTimer={(task) => start(task.id, task.title, 'timer')}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <TaskForm open={formOpen} onOpenChange={setFormOpen} task={editing} />
    </div>
  )
}
