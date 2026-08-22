import { AnimatePresence, motion } from 'framer-motion'
import { Pause, Play, Stop } from '@phosphor-icons/react'
import { fmtDuration } from '@/lib/dates'
import { elapsedSeconds, phaseTargetSeconds, useTimerStore } from '@/store/timerStore'
import { useTimerControls } from './useTimerControls'
import { useTick } from './useTick'

const PHASE_LABEL = { focus: 'تركيز', break: 'استراحة', longbreak: 'استراحة طويلة' } as const

/** Floating bar shown whenever a timer/pomodoro is active. */
export function RunningBar() {
  const store = useTimerStore()
  const { pause, resume, stop } = useTimerControls()
  useTick(store.status === 'running')

  const active = store.status !== 'idle'
  const secs = elapsedSeconds(store)
  const isPomo = store.mode === 'pomodoro'
  const target = isPomo ? phaseTargetSeconds(store.phase, store.config) : 0
  const remaining = isPomo ? Math.max(0, target - secs) : 0
  const pct = isPomo && target > 0 ? Math.min(100, (secs / target) * 100) : 0

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="fixed z-40 inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-6 md:end-6 md:w-[22rem]"
        >
          <div className="glass rounded-3xl p-3 pe-4 flex items-center gap-3 overflow-hidden relative">
            {isPomo && (
              <div
                className="absolute inset-x-0 bottom-0 h-0.5 bg-accent transition-[width] duration-1000 ease-linear"
                style={{ width: `${pct}%` }}
              />
            )}
            <div
              className={`grid place-items-center h-11 w-11 rounded-2xl shrink-0 ${
                store.phase === 'focus' || !isPomo ? 'bg-accent-faint text-accent-strong' : 'bg-priority-low/15 text-priority-low'
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${store.status === 'running' ? 'bg-current animate-breathe' : 'bg-current opacity-60'}`} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{store.taskTitle ?? 'جلسة عمل'}</p>
              <p className="text-xs text-ink-400">
                {isPomo ? `${PHASE_LABEL[store.phase]} • متبقٍ ` : 'منقضٍ '}
                <span className="nums text-ink-200">{fmtDuration(isPomo ? remaining : secs)}</span>
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {store.status === 'running' ? (
                <IconBtn onClick={pause} label="إيقاف مؤقت">
                  <Pause size={18} weight="fill" />
                </IconBtn>
              ) : (
                <IconBtn onClick={resume} label="متابعة">
                  <Play size={18} weight="fill" />
                </IconBtn>
              )}
              <IconBtn onClick={stop} label="إنهاء" danger>
                <Stop size={18} weight="fill" />
              </IconBtn>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function IconBtn({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`grid place-items-center h-10 w-10 rounded-xl transition-colors active:scale-95 focus-ring ${
        danger ? 'text-priority-high hover:bg-priority-high/15' : 'text-ink-200 hover:bg-white/[0.08]'
      }`}
    >
      {children}
    </button>
  )
}
