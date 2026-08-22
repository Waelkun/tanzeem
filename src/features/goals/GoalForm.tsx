import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/form'
import { useCreateGoal, useUpdateGoal } from '@/lib/queries'
import type { Goal } from '@/lib/types'
import { cn } from '@/lib/cn'

const COLORS = ['#34b98a', '#5a9bd4', '#d6a24a', '#e0755f', '#a78bda', '#4fb0a5', '#d98cb3']

export function GoalForm({
  open,
  onOpenChange,
  goal,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  goal?: Goal | null
}) {
  const create = useCreateGoal()
  const update = useUpdateGoal()
  const editing = !!goal
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetHours, setTargetHours] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(goal?.title ?? '')
    setDescription(goal?.description ?? '')
    setTargetHours(goal?.target_hours ? String(goal.target_hours) : '')
    setColor(goal?.color ?? COLORS[0])
    setError('')
  }, [open, goal])

  const submit = () => {
    if (!title.trim()) {
      setError('العنوان مطلوب')
      return
    }
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      target_hours: Number(targetHours) || 0,
      color,
    }
    if (editing && goal) {
      update.mutate({ id: goal.id, patch: payload }, { onSuccess: () => onOpenChange(false) })
    } else {
      create.mutate(payload, { onSuccess: () => onOpenChange(false) })
    }
  }

  const pending = create.isPending || update.isPending

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={editing ? 'تعديل الهدف' : 'هدف جديد'}>
      <div className="space-y-4">
        <Field label="العنوان" error={error}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: تعلّم الإنجليزية" autoFocus />
        </Field>
        <Field label="عدد الساعات المستهدفة" hint="اترك 0 إن لم يكن للهدف ساعات محددة">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={targetHours}
            onChange={(e) => setTargetHours(e.target.value)}
            placeholder="40"
          />
        </Field>
        <Field label="اللون">
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  'h-9 w-9 rounded-xl transition-transform active:scale-90 focus-ring',
                  color === c && 'ring-2 ring-offset-2 ring-offset-ink-900 ring-white/70',
                )}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </Field>
        <Field label="وصف (اختياري)">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="لماذا هذا الهدف مهم؟" />
        </Field>
        <div className="flex gap-2 pt-1">
          <Button variant="primary" className="flex-1" onClick={submit} disabled={pending}>
            {pending ? 'جارٍ الحفظ…' : editing ? 'حفظ التغييرات' : 'إنشاء الهدف'}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
        </div>
      </div>
    </Modal>
  )
}
