import { describe, it, expect } from 'vitest'
import { nextOccurrencePatch, occursOn, scheduledHour } from './recurrence'
import { parseISO } from 'date-fns'
import type { Task } from './types'

// Build a Task with only the fields recurrence logic reads.
function task(partial: Partial<Task>): Task {
  return {
    id: 't1',
    title: 'x',
    status: 'todo',
    priority: 'med',
    recurrence: 'none',
    due_date: null,
    scheduled_start: null,
    scheduled_end: null,
    ...partial,
  } as Task
}

// Local-time anchors (midday) so the tests are timezone-robust.
const mon = new Date(2026, 0, 5, 12, 0) // Mon 2026-01-05
const tue = new Date(2026, 0, 6, 12, 0)
const nextMon = new Date(2026, 0, 12, 12, 0)
const feb5 = new Date(2026, 1, 5, 12, 0)

describe('occursOn — non-recurring', () => {
  it('matches only its own day', () => {
    const t = task({ recurrence: 'none', due_date: mon.toISOString() })
    expect(occursOn(t, mon)).toBe(true)
    expect(occursOn(t, tue)).toBe(false)
  })
  it('never occurs without an anchor date', () => {
    expect(occursOn(task({ recurrence: 'none' }), mon)).toBe(false)
  })
})

describe('occursOn — daily', () => {
  it('occurs every day when it has no anchor', () => {
    expect(occursOn(task({ recurrence: 'daily' }), mon)).toBe(true)
    expect(occursOn(task({ recurrence: 'daily' }), tue)).toBe(true)
  })
  it('does not project before its anchor', () => {
    const t = task({ recurrence: 'daily', due_date: tue.toISOString() })
    expect(occursOn(t, mon)).toBe(false) // mon is before the tue anchor
    expect(occursOn(t, tue)).toBe(true)
    expect(occursOn(t, nextMon)).toBe(true)
  })
})

describe('occursOn — weekly', () => {
  it('recurs on the same weekday from the anchor onward', () => {
    const t = task({ recurrence: 'weekly', scheduled_start: mon.toISOString() })
    expect(occursOn(t, mon)).toBe(true)
    expect(occursOn(t, nextMon)).toBe(true)
    expect(occursOn(t, tue)).toBe(false)
  })
})

describe('occursOn — monthly', () => {
  it('recurs on the same day-of-month from the anchor onward', () => {
    const t = task({ recurrence: 'monthly', due_date: mon.toISOString() }) // the 5th
    expect(occursOn(t, mon)).toBe(true)
    expect(occursOn(t, feb5)).toBe(true) // 5th of next month
    expect(occursOn(t, tue)).toBe(false) // the 6th
  })
})

describe('occursOn — monthly month-end clamp', () => {
  it('projects a day-31 anchor onto the last day of shorter months', () => {
    const jan31 = new Date(2026, 0, 31, 12, 0)
    const t = task({ recurrence: 'monthly', due_date: jan31.toISOString() })
    expect(occursOn(t, new Date(2026, 1, 28, 12, 0))).toBe(true) // Feb 28 (last day)
    expect(occursOn(t, new Date(2026, 1, 27, 12, 0))).toBe(false)
    expect(occursOn(t, new Date(2026, 2, 31, 12, 0))).toBe(true) // Mar 31 exact
  })
})

describe('nextOccurrencePatch', () => {
  it('advances the due date by one interval and keeps the task active', () => {
    const p = nextOccurrencePatch(task({ recurrence: 'daily', due_date: mon.toISOString() }))
    expect(p.status).toBeUndefined() // not marked done
    expect(parseISO(p.due_date as string).getDate()).toBe(6) // Mon 5th → Tue 6th
  })
  it('advances weekly by 7 days and monthly by a month, preserving scheduled_start', () => {
    const wk = nextOccurrencePatch(task({ recurrence: 'weekly', scheduled_start: mon.toISOString() }))
    expect(parseISO(wk.scheduled_start as string).getDate()).toBe(12) // +7
    const mo = nextOccurrencePatch(task({ recurrence: 'monthly', due_date: mon.toISOString() }))
    expect(parseISO(mo.due_date as string).getMonth()).toBe(1) // Jan → Feb
  })
  it('seeds a due date for a dateless recurring task so it leaves today', () => {
    const p = nextOccurrencePatch(task({ recurrence: 'daily' }))
    expect(p.due_date).toBeTruthy()
  })
})

describe('scheduledHour', () => {
  it('returns the local hour of scheduled_start, or null', () => {
    expect(scheduledHour(task({ scheduled_start: new Date(2026, 0, 5, 9, 30).toISOString() }))).toBe(9)
    expect(scheduledHour(task({}))).toBeNull()
  })
})
