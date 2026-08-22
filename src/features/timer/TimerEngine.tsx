import { useEffect } from 'react'
import { useLogSession, useSettings } from '@/lib/queries'
import { localNotify, playChime, vibrate } from '@/lib/alerts'
import { elapsedSeconds, phaseTargetSeconds, useTimerStore } from '@/store/timerStore'

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

  useEffect(() => {
    const id = setInterval(() => {
      const s = useTimerStore.getState()
      if (s.status !== 'running' || s.mode !== 'pomodoro') return

      const target = phaseTargetSeconds(s.phase, s.config)
      if (elapsedSeconds(s) < target) return

      if (s.phase === 'focus') {
        // Log the completed focus block.
        log.mutate({
          task_id: s.taskId,
          started_at: s.phaseStartedAtISO ?? new Date(Date.now() - target * 1000).toISOString(),
          ended_at: new Date().toISOString(),
          duration_seconds: target,
          mode: 'pomodoro',
        })
        const done = s.completedFocus + 1
        s.bumpCompletedFocus()
        const next = done >= s.config.cycles ? 'longbreak' : 'break'
        s.setPhase(next)
        s.restartSegment()
        playChime('focus-end')
        localNotify('انتهت جلسة التركيز', next === 'longbreak' ? 'حان وقت الاستراحة الطويلة' : 'حان وقت الاستراحة')
        vibrate([40, 40, 40])
      } else {
        const wasLong = s.phase === 'longbreak'
        s.setPhase('focus')
        s.restartSegment()
        if (wasLong) useTimerStore.setState({ completedFocus: 0 })
        playChime('break-end')
        localNotify('انتهت الاستراحة', 'ابدأ جلسة تركيز جديدة')
        vibrate(40)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [log])

  return null
}
