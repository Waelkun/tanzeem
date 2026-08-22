import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Confetti, DotsThreeVertical, TrashSimple, Trophy } from '@phosphor-icons/react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/form'
import { EmptyState } from '@/components/ui/states'
import { useAchievements, useAddAchievement, useDeleteAchievement } from '@/lib/queries'
import { bigCelebrate } from '@/lib/celebrate'
import { vibrate } from '@/lib/alerts'
import { fmtTime } from '@/lib/dates'
import type { Achievement } from '@/lib/types'
import { isToday, isYesterday, parseISO } from 'date-fns'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'

/** Group achievements under a human day label (اليوم / أمس / full date). */
function dayLabel(iso: string): string {
  const d = parseISO(iso)
  if (isToday(d)) return 'اليوم'
  if (isYesterday(d)) return 'أمس'
  return format(d, 'EEEE، d MMMM yyyy', { locale: ar })
}

export default function Achievements() {
  const { data: achievements } = useAchievements()
  const add = useAddAchievement()
  const del = useDeleteAchievement()
  const [text, setText] = useState('')

  const submit = () => {
    const t = text.trim()
    if (!t) return
    add.mutate({ text: t })
    setText('')
    bigCelebrate()
    vibrate([30, 30, 60])
  }

  // Group by day, preserving the newest-first order from the query.
  const groups = useMemo(() => {
    const map = new Map<string, Achievement[]>()
    for (const a of achievements ?? []) {
      const label = dayLabel(a.created_at)
      const arr = map.get(label) ?? []
      arr.push(a)
      map.set(label, arr)
    }
    return Array.from(map.entries())
  }, [achievements])

  const total = achievements?.length ?? 0

  return (
    <div>
      <PageHeader
        title="الإنجازات"
        subtitle={total > 0 ? `سجّلت ${total} إنجازاً حتى الآن — كلها محفوظة دائماً` : 'سجّل إنجازاتك واحتفظ بها للأبد'}
      />

      {/* Log an achievement */}
      <div className="glass rounded-3xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="grid place-items-center h-8 w-8 rounded-xl bg-accent-faint text-accent-strong">
            <Trophy size={18} weight="fill" />
          </span>
          <h3 className="font-semibold tracking-tight">سجّل إنجازاً جديداً</h3>
        </div>
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="ماذا أنجزت؟"
          />
          <Button variant="primary" onClick={submit} disabled={!text.trim()}>
            <Confetti size={18} weight="fill" />
          </Button>
        </div>
      </div>

      {/* Timeline */}
      {total === 0 ? (
        <EmptyState
          icon={Trophy}
          title="لا إنجازات بعد"
          hint="كل إنجاز تسجّله يظهر هنا مؤرّخاً ويبقى محفوظاً دائماً"
        />
      ) : (
        <div className="space-y-6">
          {groups.map(([label, items]) => (
            <div key={label}>
              <p className="text-xs font-medium text-ink-400 mb-2.5 ps-1">{label}</p>
              <div className="glass rounded-3xl p-2">
                <AnimatePresence initial={false}>
                  {items.map((a) => (
                    <motion.div
                      key={a.id}
                      layout
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-2xl hover:bg-white/[0.03] group"
                    >
                      <span className="mt-0.5 grid place-items-center h-7 w-7 rounded-full bg-accent-faint text-accent-strong shrink-0">
                        <Trophy size={14} weight="fill" />
                      </span>
                      <span className="flex-1 text-sm text-ink-100 leading-relaxed">{a.text}</span>
                      <span className="text-[11px] text-ink-500 shrink-0 mt-1 nums">{fmtTime(a.created_at)}</span>
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button
                            aria-label="خيارات"
                            className="shrink-0 grid place-items-center h-7 w-7 rounded-lg text-ink-400 hover:bg-white/[0.08] transition-colors focus-ring opacity-60 group-hover:opacity-100"
                          >
                            <DotsThreeVertical size={16} weight="bold" />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content align="end" sideOffset={6} className="glass rounded-2xl p-1.5 min-w-36 z-50 text-sm">
                            <DropdownMenu.Item
                              onSelect={() => del.mutate(a.id)}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer outline-none text-priority-high data-[highlighted]:bg-priority-high/15"
                            >
                              <TrashSimple size={16} />
                              حذف
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
