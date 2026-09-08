import { useEffect, useRef } from 'react'
import { useLogSession, useSettings } from '@/lib/queries'
import { localNotify, playChime, vibrate } from '@/lib/alerts'
import { elapsedSeconds, phaseTargetSeconds, useTimerStore } from '@/store/timerStore'
import { advanceTimer, applyAdvanced, type TimerSyncState } from './timerSync'

/**
 * Headless engine: syncs pomodoro config from settings and drives automatic
 * focus/break phase transitions (logging each completed focus session).
 * Renders nothing; mounted once at app root.
 */
export function TimerEngine() {
  const log = useLogSession()
  const { data: settings } = useSettings()

  // Keep the timer's pomodoro config in sync with saved settings.
  useEffect(() => {
    if (!settings) return
    useTimerStore.getState().setConfig({
      focusMin: settings.pomodoro_focus_min,
      breakMin: settings.pomodoro_break_min,
      longBreakMin: settings.pomodoro_long_break_min,
      cycles: settings.pomodoro_cycles,
    })
  }, [settings])

  // Prevents overlapping transition attempts while the async claim is in flight.
  const claiming = useRef(false)

  useEffect(() => {
    const id = setInterval(() => {
      if (claiming.current) return
      const s = useTimerStore.getState()
      if (s.status !== 'running' || s.mode !== 'pomodoro') return

      const target = phaseTargetSeconds(s.phase, s.config)
      if (elapsedSeconds(s) < target) return

      const from = s.phaseStartedAtISO
      const base = {
        status: 'running' as const,
        mode: 'pomodoro' as const,
        taskId: s.taskId,
        taskTitle: s.taskTitle,
        segmentStart: Date.now(),
        baseElapsed: 0,
        phaseStartedAtISO: new Date().toISOString(),
      }

      if (s.phase === 'focus') {
        const done = s.completedFocus + 1
        const next: TimerSyncState = {
          ...base,
          phase: done >= s.config.cycles ? 'longbreak' : 'break',
          completedFocus: done,
        }
        claiming.current = true
        // Claim the transition: only the winning device logs + advances; the
        // others receive the new phase via realtime, so no duplicate session.
        void advanceTimer(from, next).then((won) => {
          claiming.current = false
          if (!won) return
          log.mutate({
            task_id: s.taskId,
            started_at: from ?? new Date(Date.now() - target * 1000).toISOString(),
            ended_at: new Date().toISOString(),
            duration_seconds: target,
            mode: 'pomodoro',
          })
          applyAdvanced(next)
          playChime('focus-end')
          localNotify(
            'انتهت جلسة التركيز',
            next.phase === 'longbreak' ? 'حان وقت الاستراحة الطويلة' : 'حان وقت الاستراحة',
          )
          vibrate([40, 40, 40])
        })
      } else {
        const wasLong = s.phase === 'longbreak'
        const next: TimerSyncState = {
          ...base,
          phase: 'focus',
          completedFocus: wasLong ? 0 : s.completedFocus,
        }
        claiming.current = true
        void advanceTimer(from, next).then((won) => {
          claiming.current = false
          if (!won) return
          applyAdvanced(next)
          playChime('break-end')
          localNotify('انتهت الاستراحة', 'ابدأ جلسة تركيز جديدة')
          vibrate(40)
        })
      }
    }, 1000)
    return () => clearInterval(id)
  }, [log])

  return null
}
