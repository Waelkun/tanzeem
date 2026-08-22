import { useLogSession } from '@/lib/queries'
import type { SessionMode } from '@/lib/types'
import { elapsedSeconds, useTimerStore } from '@/store/timerStore'

/** Start/pause/resume/stop controls that also persist finished work sessions. */
export function useTimerControls() {
  const log = useLogSession()

  const start = (taskId: string | null, taskTitle: string | null, mode: SessionMode) =>
    useTimerStore.getState().start({ taskId, taskTitle, mode })

  const pause = () => useTimerStore.getState().pause()
  const resume = () => useTimerStore.getState().resume()

  const stop = () => {
    const s = useTimerStore.getState()
    // Log the in-progress work segment (plain timer, or the focus phase of a pomodoro).
    const isWork = s.mode === 'timer' || s.phase === 'focus'
    const secs = elapsedSeconds(s)
    if (isWork && secs >= 10 && s.phaseStartedAtISO) {
      log.mutate({
        task_id: s.taskId,
        started_at: s.phaseStartedAtISO,
        ended_at: new Date().toISOString(),
        duration_seconds: secs,
        mode: s.mode,
      })
    }
    s.reset()
  }

  return { start, pause, resume, stop }
}
