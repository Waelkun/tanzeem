import { describe, it, expect } from 'vitest'
import { elapsedSeconds, phaseTargetSeconds } from './timerStore'

describe('elapsedSeconds', () => {
  it('returns baseElapsed (floored) when paused', () => {
    expect(elapsedSeconds({ status: 'paused', segmentStart: null, baseElapsed: 42.9 })).toBe(42)
  })
  it('adds live time from segmentStart while running', () => {
    const secs = elapsedSeconds({ status: 'running', segmentStart: Date.now() - 5000, baseElapsed: 10 })
    expect(secs).toBeGreaterThanOrEqual(15)
    expect(secs).toBeLessThan(17)
  })
  it('ignores live time when idle', () => {
    expect(elapsedSeconds({ status: 'idle', segmentStart: null, baseElapsed: 0 })).toBe(0)
  })
})

describe('phaseTargetSeconds', () => {
  const cfg = { focusMin: 25, breakMin: 5, longBreakMin: 15, cycles: 4 }
  it('maps each phase to its configured minutes', () => {
    expect(phaseTargetSeconds('focus', cfg)).toBe(1500)
    expect(phaseTargetSeconds('break', cfg)).toBe(300)
    expect(phaseTargetSeconds('longbreak', cfg)).toBe(900)
  })
})
