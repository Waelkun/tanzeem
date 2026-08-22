import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Sparkle, X } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/form'
import { ErrorState } from '@/components/ui/states'
import { invokeFunction } from '@/lib/supabase'
import { useUpdateTask } from '@/lib/queries'
import { fmtTime } from '@/lib/dates'
import type { DailyPlanItem } from '@/lib/types'

type Phase = 'idle' | 'loading' | 'proposed' | 'error'

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

export function DailyPlanModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const update = useUpdateTask()
  const [phase, setPhase] = useState<Phase>('idle')
  const [items, setItems] = useState<DailyPlanItem[]>([])
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')

  const generate = async () => {
    setPhase('loading')
    setError('')
    try {
      const res = await invokeFunction<{ plan: DailyPlanItem[]; summary?: string }>('ai-daily-plan', {})
      setItems(res.plan ?? [])
      setSummary(res.summary ?? '')
      setPhase('proposed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر إنشاء الخطة')
      setPhase('error')
    }
  }

  const apply = async () => {
    await Promise.all(
      items.map((it) =>
        update.mutateAsync({
          id: it.task_id,
          patch: { scheduled_start: it.scheduled_start, scheduled_end: it.scheduled_end },
        }),
      ),
    )
    onOpenChange(false)
    setPhase('idle')
    setItems([])
  }

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.task_id !== id))
  const setTime = (id: string, field: 'scheduled_start' | 'scheduled_end', val: string) =>
    setItems((prev) => prev.map((i) => (i.task_id === id ? { ...i, [field]: new Date(val).toISOString() } : i)))

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="خطة اليوم الذكية" description="مبنية على مهامك الحقيقية ووقتك">
      {phase === 'idle' && (
        <div className="text-center py-6">
          <div className="grid place-items-center h-16 w-16 rounded-3xl bg-accent-faint text-accent-strong mx-auto mb-4 animate-float">
            <Sparkle size={30} weight="fill" />
          </div>
          <p className="text-ink-200 text-sm max-w-xs mx-auto leading-relaxed">
            سيقترح المساعد جدولاً لمهامك المعلّقة اعتماداً على أوقات إنتاجيتك السابقة. تراجعه وتعدّله قبل التطبيق.
          </p>
          <Button variant="primary" className="mt-5" onClick={generate}>
            <Sparkle size={18} weight="fill" />
            أنشئ خطة اليوم
          </Button>
        </div>
      )}

      {phase === 'loading' && (
        <div className="py-8 space-y-3">
          <div className="flex items-center justify-center gap-2 text-accent-strong mb-4">
            <Sparkle size={20} weight="fill" className="animate-breathe" />
            <span className="text-sm">يحلّل مهامك ووقتك…</span>
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-2xl" />
          ))}
        </div>
      )}

      {phase === 'error' && <ErrorState message={error} onRetry={generate} />}

      {phase === 'proposed' && (
        <div className="space-y-4">
          {summary && <p className="text-sm text-ink-300 bg-white/[0.04] rounded-2xl p-3 leading-relaxed">{summary}</p>}

          {items.length === 0 ? (
            <p className="text-sm text-ink-400 text-center py-6">لا توجد مهام معلّقة لجدولتها اليوم.</p>
          ) : (
            <div className="space-y-2.5">
              {items.map((it) => (
                <motion.div key={it.task_id} layout className="glass-soft rounded-2xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium flex-1">{it.title}</p>
                    <button
                      onClick={() => removeItem(it.task_id)}
                      className="shrink-0 grid place-items-center h-7 w-7 rounded-lg text-ink-400 hover:bg-priority-high/15 hover:text-priority-high transition-colors"
                      aria-label="إزالة"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  {it.reason && <p className="text-xs text-ink-500 mt-1">{it.reason}</p>}
                  <div className="flex items-center gap-2 mt-2.5">
                    <Input
                      type="datetime-local"
                      className="text-xs py-1.5"
                      value={toLocalInput(it.scheduled_start)}
                      onChange={(e) => setTime(it.task_id, 'scheduled_start', e.target.value)}
                    />
                    <span className="text-ink-500 text-xs shrink-0">←</span>
                    <Input
                      type="datetime-local"
                      className="text-xs py-1.5"
                      value={toLocalInput(it.scheduled_end)}
                      onChange={(e) => setTime(it.task_id, 'scheduled_end', e.target.value)}
                    />
                  </div>
                  <p className="text-[11px] text-ink-500 mt-1.5 nums">
                    {fmtTime(it.scheduled_start)} — {fmtTime(it.scheduled_end)}
                  </p>
                </motion.div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="primary" className="flex-1" onClick={apply} disabled={items.length === 0 || update.isPending}>
              <Check size={18} weight="bold" />
              {update.isPending ? 'جارٍ التطبيق…' : 'طبّق الخطة'}
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              رفض
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
