import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/form'
import { useUpdateSession } from '@/lib/queries'
import type { Session, Task } from '@/lib/types'

/** Convert an ISO timestamp to the `YYYY-MM-DDTHH:mm` shape a datetime-local input wants (in local time). */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface Props {
  session: Session | null
  tasks: Task[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SessionEditModal({ session, tasks, open, onOpenChange }: Props) {
  const update = useUpdateSession()
  const [start, setStart] = useState('')
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(0)
  const [taskId, setTaskId] = useState<string>('')

  // Reset the form each time a different session is opened for editing.
  useEffect(() => {
    if (!session) return
    setStart(toLocalInput(session.started_at))
    setHours(Math.floor(session.duration_seconds / 3600))
    setMinutes(Math.floor((session.duration_seconds % 3600) / 60))
    setTaskId(session.task_id ?? '')
  }, [session])

  const save = () => {
    if (!session) return
    const startedAt = new Date(start)
    const duration = hours * 3600 + minutes * 60
    update.mutate(
      {
        id: session.id,
        patch: {
          started_at: startedAt.toISOString(),
          // Keep ended_at consistent with the corrected duration.
          ended_at: new Date(startedAt.getTime() + duration * 1000).toISOString(),
          duration_seconds: duration,
          task_id: taskId || null,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  const activeTasks = tasks.filter((t) => t.status !== 'done')

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="تعديل الجلسة" description="عدّل الوقت الفعلي الذي عملته">
      <div className="space-y-4">
        <Field label="المدة">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={hours}
                onChange={(e) => setHours(Math.max(0, Number(e.target.value)))}
                className="text-center"
              />
              <span className="text-sm text-ink-400 shrink-0">ساعة</span>
            </label>
            <label className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => setMinutes(Math.min(59, Math.max(0, Number(e.target.value))))}
                className="text-center"
              />
              <span className="text-sm text-ink-400 shrink-0">دقيقة</span>
            </label>
          </div>
        </Field>

        <Field label="وقت البدء">
          <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>

        <Field label="المهمة">
          <Select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">بدون مهمة محددة</option>
            {session?.task_id && !activeTasks.some((t) => t.id === session.task_id) && (
              <option value={session.task_id}>
                {tasks.find((t) => t.id === session.task_id)?.title ?? 'مهمة محذوفة'}
              </option>
            )}
            {activeTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button variant="primary" onClick={save} disabled={update.isPending}>
            {update.isPending ? 'جارٍ الحفظ…' : 'حفظ'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
