import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Segmented, Select, Textarea } from '@/components/ui/form'
import { useCreateTask, useGoals, useUpdateTask } from '@/lib/queries'
import { CategoryPicker } from './CategoryPicker'
import {
  RECURRENCE_LABELS,
  type Recurrence,
  type Task,
  type TaskPriority,
} from '@/lib/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: Task | null
  defaultGoalId?: string | null
}

/** Convert an ISO string to a value for <input type="datetime-local">. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}
function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null
}

export function TaskForm({ open, onOpenChange, task, defaultGoalId }: Props) {
  const create = useCreateTask()
  const update = useUpdateTask()
  const { data: goals } = useGoals()
  const editing = !!task

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('med')
  const [category, setCategory] = useState('')
  const [goalId, setGoalId] = useState<string>('')
  const [due, setDue] = useState('')
  const [recurrence, setRecurrence] = useState<Recurrence>('none')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setTitle(task?.title ?? '')
    setNotes(task?.notes ?? '')
    setPriority(task?.priority ?? 'med')
    setCategory(task?.category ?? '')
    setGoalId(task?.goal_id ?? defaultGoalId ?? '')
    setDue(toLocalInput(task?.due_date))
    setRecurrence(task?.recurrence ?? 'none')
  }, [open, task, defaultGoalId])

  const submit = () => {
    if (!title.trim()) {
      setError('العنوان مطلوب')
      return
    }
    const payload = {
      title: title.trim(),
      notes: notes.trim() || null,
      priority,
      category: category.trim() || null,
      goal_id: goalId || null,
      due_date: fromLocalInput(due),
      recurrence,
    }
    if (editing && task) {
      update.mutate({ id: task.id, patch: payload }, { onSuccess: () => onOpenChange(false) })
    } else {
      create.mutate(payload, { onSuccess: () => onOpenChange(false) })
    }
  }

  const pending = create.isPending || update.isPending

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'تعديل المهمة' : 'مهمة جديدة'}
    >
      <div className="space-y-4">
        <Field label="العنوان" error={error}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ماذا تريد أن تنجز؟"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
            }}
          />
        </Field>

        <Field label="الأولوية">
          <Segmented
            value={priority}
            onChange={setPriority}
            options={[
              { value: 'high', label: 'عالية', color: '#e0755f' },
              { value: 'med', label: 'متوسطة', color: '#d6a24a' },
              { value: 'low', label: 'منخفضة', color: '#5a9bd4' },
            ]}
          />
        </Field>

        <Field label="الفئة">
          <CategoryPicker value={category} onChange={setCategory} />
        </Field>

        <Field label="الهدف">
          <Select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">بدون هدف</option>
            {goals?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="موعد الاستحقاق">
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label="التكرار">
            <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
              {(Object.keys(RECURRENCE_LABELS) as Recurrence[]).map((r) => (
                <option key={r} value={r}>
                  {RECURRENCE_LABELS[r]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="ملاحظات" hint="يدعم Markdown">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="تفاصيل إضافية…" />
        </Field>

        <div className="flex gap-2 pt-1">
          <Button variant="primary" className="flex-1" onClick={submit} disabled={pending}>
            {pending ? 'جارٍ الحفظ…' : editing ? 'حفظ التغييرات' : 'إضافة المهمة'}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
        </div>
      </div>
    </Modal>
  )
}
