import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Confetti, Trophy } from '@phosphor-icons/react'
import { Input } from '@/components/ui/form'
import { Button } from '@/components/ui/Button'
import { useAchievements, useAddAchievement } from '@/lib/queries'
import { bigCelebrate } from '@/lib/celebrate'
import { vibrate } from '@/lib/alerts'
import { relative } from '@/lib/dates'

export function AchievementBox() {
  const { data: achievements } = useAchievements()
  const add = useAddAchievement()
  const [text, setText] = useState('')

  const submit = () => {
    const t = text.trim()
    if (!t) return
    add.mutate({ text: t })
    setText('')
    bigCelebrate()
    vibrate([30, 30, 60])
  }

  const recent = (achievements ?? []).slice(0, 4)

  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center h-8 w-8 rounded-xl bg-accent-faint text-accent-strong">
            <Trophy size={18} weight="fill" />
          </span>
          <h3 className="font-semibold tracking-tight">سجّل إنجازاً</h3>
        </div>
        <Link to="/achievements" className="text-xs text-accent-strong hover:underline shrink-0 focus-ring rounded">
          عرض الكل ←
        </Link>
      </div>

      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="ماذا أنجزت للتو؟"
        />
        <Button variant="primary" onClick={submit} disabled={!text.trim()}>
          <Confetti size={18} weight="fill" />
        </Button>
      </div>

      {recent.length > 0 && (
        <ul className="mt-4 space-y-2">
          <AnimatePresence initial={false}>
            {recent.map((a) => (
              <motion.li
                key={a.id}
                layout
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2.5 text-sm"
              >
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                <span className="flex-1 text-ink-200">{a.text}</span>
                <span className="text-[11px] text-ink-500 shrink-0">{relative(a.created_at)}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  )
}
