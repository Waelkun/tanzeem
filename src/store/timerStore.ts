import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SessionMode } from '@/lib/types'

export type PomoPhase = 'focus' | 'break' | 'longbreak'
export type TimerStatus = 'idle' | 'running' | 'paused'

export interface PomodoroConfig {
  focusMin: number
  breakMin: number
  longBreakMin: number
  cycles: number
}

export interface TimerState {
  status: TimerStatus
  mode: SessionMode
  taskId: string | null
  taskTitle: string | null
  segmentStart: number | null // Date.now() ms when the running segment began
  baseElapsed: number // seconds accumulated before the current segment
  // pomodoro
  phase: PomoPhase
  completedFocus: number
  config: PomodoroConfig
  // when the current run segment began (for the running phase); used to log sessions
  phaseStartedAtISO: string | null

  start: (opts: { taskId: string | null; taskTitle: string | null; mode: SessionMode }) => void
  pause: () => void
  resume: () => void
  reset: () => void
  setConfig: (c: Partial<PomodoroConfig>) => void
  setPhase: (phase: PomoPhase) => void
  bumpCompletedFocus: () => void
  restartSegment: () => void
}

const DEFAULT_CONFIG: PomodoroConfig = { focusMin: 25, breakMin: 5, longBreakMin: 15, cycles: 4 }

export const useTimerStore = create<TimerState>()(
  persist(
    (set) => ({
      status: 'idle',
      mode: 'timer',
      taskId: null,
      taskTitle: null,
      segmentStart: null,
      baseElapsed: 0,
      phase: 'focus',
      completedFocus: 0,
      config: DEFAULT_CONFIG,
      phaseStartedAtISO: null,

      start: ({ taskId, taskTitle, mode }) =>
        set({
          status: 'running',
          mode,
          taskId,
          taskTitle,
          segmentStart: Date.now(),
          baseElapsed: 0,
          phase: 'focus',
          completedFocus: 0,
          phaseStartedAtISO: new Date().toISOString(),
        }),

      pause: () =>
        set((s) => {
          if (s.status !== 'running' || s.segmentStart == null) return s
          const extra = (Date.now() - s.segmentStart) / 1000
          return { status: 'paused', baseElapsed: s.baseElapsed + extra, segmentStart: null }
        }),

      resume: () => set({ status: 'running', segmentStart: Date.now() }),

      reset: () =>
        set({
          status: 'idle',
          taskId: null,
          taskTitle: null,
          segmentStart: null,
          baseElapsed: 0,
          phase: 'focus',
          completedFocus: 0,
          phaseStartedAtISO: null,
        }),

      setConfig: (c) => set((s) => ({ config: { ...s.config, ...c } })),
      setPhase: (phase) => set({ phase }),
      bumpCompletedFocus: () => set((s) => ({ completedFocus: s.completedFocus + 1 })),
      // start a fresh timing segment (used when moving to a new pomodoro phase)
      restartSegment: () =>
        set({ segmentStart: Date.now(), baseElapsed: 0, phaseStartedAtISO: new Date().toISOString() }),
    }),
    { name: 'tanzeem-timer' },
  ),
)

/** Live elapsed seconds for the current segment (call inside a ticking render). */
export function elapsedSeconds(s: Pick<TimerState, 'status' | 'segmentStart' | 'baseElapsed'>): number {
  const live = s.status === 'running' && s.segmentStart != null ? (Date.now() - s.segmentStart) / 1000 : 0
  return Math.floor(s.baseElapsed + live)
}

export function phaseTargetSeconds(phase: PomoPhase, c: PomodoroConfig): number {
  if (phase === 'focus') return c.focusMin * 60
  if (phase === 'break') return c.breakMin * 60
  return c.longBreakMin * 60
}
