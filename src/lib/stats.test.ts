import { describe, it, expect } from 'vitest'
import {
  computeStreak,
  taskBreakdown,
  taskDetail,
  tasksDoneToday,
  todaySeconds,
  weekStats,
  weekTaskDayMatrix,
} from './stats'
import type { Session, Task } from './types'

function task(p: Partial<Task>): Task {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'x',
    status: 'todo',
    priority: 'med',
    recurrence: 'none',
    due_date: null,
    scheduled_start: null,
    scheduled_end: null,
    completed_at: null,
    ...p,
  } as Task
}
function session(p: Partial<Session>): Session {
  return {
    id: Math.random().toString(36).slice(2),
    task_id: null,
    started_at: new Date().toISOString(),
    ended_at: null,
    duration_seconds: 0,
    mode: 'timer',
    ...p,
  } as Session
}

// A fixed reference week: Mon 2026-01-05 .. Sun 2026-01-11 (local midday anchors).
const monNoon = new Date(2026, 0, 5, 12, 0)
const wedNoon = new Date(2026, 0, 7, 10, 0)

describe('weekStats', () => {
  it('starts the week on Monday and orders perDay Mon→Sun', () => {
    const s = weekStats([], [], monNoon)
    expect(s.perDay.map((d) => d.day)).toEqual([
      'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد',
    ])
  })

  it('sums exact session seconds within the week and buckets per day', () => {
    const sessions = [
      session({ started_at: monNoon.toISOString(), duration_seconds: 30 }),
      session({ started_at: wedNoon.toISOString(), duration_seconds: 3600 }),
      // outside the week — must be ignored
      session({ started_at: new Date(2026, 0, 20, 12).toISOString(), duration_seconds: 999 }),
    ]
    const s = weekStats([], sessions, monNoon)
    expect(s.totalSeconds).toBe(3630)
    expect(s.perDay[0].seconds).toBe(30) // Monday
    expect(s.perDay[2].seconds).toBe(3600) // Wednesday
    expect(s.mostProductiveDay).toBe('الأربعاء')
  })

  it('collects completed tasks within the week (most-recent first)', () => {
    const tasks = [
      task({ status: 'done', completed_at: monNoon.toISOString(), title: 'A' }),
      task({ status: 'done', completed_at: wedNoon.toISOString(), title: 'B' }),
      task({ status: 'done', completed_at: new Date(2025, 11, 1).toISOString(), title: 'old' }),
      task({ status: 'todo' }),
    ]
    const s = weekStats(tasks, [], monNoon)
    expect(s.tasksCompleted).toBe(2)
    expect(s.completedTasks.map((t) => t.title)).toEqual(['B', 'A'])
  })
})

describe('taskBreakdown', () => {
  const weekStart = new Date(2026, 0, 5, 0, 0) // Mon
  const weekEnd = new Date(2026, 0, 11, 23, 59, 59) // Sun
  const tasks = [task({ id: 't1', title: 'التقديم' }), task({ id: 't2', title: 'دراسة' })]
  const sessions = [
    session({ task_id: 't1', started_at: monNoon.toISOString(), duration_seconds: 1800 }), // Mon 30m
    session({ task_id: 't1', started_at: wedNoon.toISOString(), duration_seconds: 5400 }), // Wed 90m
    session({ task_id: 't2', started_at: wedNoon.toISOString(), duration_seconds: 600 }), // Wed 10m
    session({ task_id: null, started_at: monNoon.toISOString(), duration_seconds: 120 }), // untracked Mon
  ]

  it('aggregates per task across the week, sorted desc, resolving titles', () => {
    const { perTask, totalSeconds } = taskBreakdown(tasks, sessions, weekStart, weekEnd, null)
    expect(totalSeconds).toBe(1800 + 5400 + 600 + 120)
    expect(perTask.map((t) => [t.title, t.seconds])).toEqual([
      ['التقديم', 7200],
      ['دراسة', 600],
      ['وقت غير مرتبط بمهمة', 120],
    ])
  })

  it('filters to a single weekday when dayIndex is given', () => {
    // Wednesday = getDay() 3
    const { perTask, totalSeconds } = taskBreakdown(tasks, sessions, weekStart, weekEnd, 3)
    expect(totalSeconds).toBe(5400 + 600)
    expect(perTask.map((t) => [t.title, t.seconds])).toEqual([
      ['التقديم', 5400],
      ['دراسة', 600],
    ])
  })
})

describe('taskDetail', () => {
  const weekStart = new Date(2026, 0, 5, 0, 0)
  const weekEnd = new Date(2026, 0, 11, 23, 59, 59)
  const tasks = [task({ id: 't1', title: 'التقديم' })]
  const sessions = [
    session({ task_id: 't1', started_at: monNoon.toISOString(), duration_seconds: 1800 }), // Mon
    session({ task_id: 't1', started_at: wedNoon.toISOString(), duration_seconds: 5400 }), // Wed
    session({ task_id: 't1', started_at: new Date(2026, 0, 20, 12).toISOString(), duration_seconds: 999 }), // outside week
  ]

  it('totals the task within the week and breaks it down Mon→Sun', () => {
    const d = taskDetail('t1', tasks, sessions, weekStart, weekEnd)
    expect(d.title).toBe('التقديم')
    expect(d.totalSeconds).toBe(7200) // excludes the out-of-week 999
    expect(d.perDay).toHaveLength(7)
    expect(d.perDay[0]).toMatchObject({ day: 'الاثنين', seconds: 1800 })
    expect(d.perDay[2]).toMatchObject({ day: 'الأربعاء', seconds: 5400 })
    expect(d.sessions).toHaveLength(2) // the "when", newest first
    expect(d.sessions[0].seconds).toBe(5400)
  })
})

describe('weekTaskDayMatrix', () => {
  const weekStart = new Date(2026, 0, 5, 0, 0)
  const weekEnd = new Date(2026, 0, 11, 23, 59, 59)
  const tasks = [task({ id: 't1', title: 'التقديم' }), task({ id: 't2', title: 'دراسة' })]
  const sessions = [
    session({ task_id: 't1', started_at: monNoon.toISOString(), duration_seconds: 1800 }), // Mon
    session({ task_id: 't1', started_at: wedNoon.toISOString(), duration_seconds: 5400 }), // Wed
    session({ task_id: 't2', started_at: wedNoon.toISOString(), duration_seconds: 600 }), // Wed
  ]

  it('returns 7 days Mon→Sun with per-task seconds and totals', () => {
    const { tasks: ranked, days } = weekTaskDayMatrix(tasks, sessions, weekStart, weekEnd)
    expect(ranked.map((t) => t.id)).toEqual(['t1', 't2']) // sorted desc by week total
    expect(days).toHaveLength(7)
    expect(days[0]).toMatchObject({ day: 'الاثنين', total: 1800, perTask: { t1: 1800 } }) // Mon
    expect(days[2]).toMatchObject({ day: 'الأربعاء', total: 6000, perTask: { t1: 5400, t2: 600 } }) // Wed
    expect(days[6]).toMatchObject({ day: 'الأحد', total: 0, perTask: {} }) // Sun empty
  })
})

describe('computeStreak', () => {
  it('counts consecutive active days ending today', () => {
    const mk = (daysAgo: number) => {
      const d = new Date()
      d.setDate(d.getDate() - daysAgo)
      d.setHours(12, 0, 0, 0)
      return d.toISOString()
    }
    const tasks = [
      task({ status: 'done', completed_at: mk(0) }),
      task({ status: 'done', completed_at: mk(1) }),
      task({ status: 'done', completed_at: mk(2) }),
    ]
    expect(computeStreak(tasks, [])).toBe(3)
  })

  it('is zero with no activity', () => {
    expect(computeStreak([], [])).toBe(0)
  })
})

describe('todaySeconds / tasksDoneToday', () => {
  it('counts only today', () => {
    const now = new Date()
    now.setHours(12, 0, 0, 0)
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    expect(
      todaySeconds([
        session({ started_at: now.toISOString(), duration_seconds: 100 }),
        session({ started_at: yesterday.toISOString(), duration_seconds: 50 }),
      ]),
    ).toBe(100)
    expect(
      tasksDoneToday([
        task({ status: 'done', completed_at: now.toISOString() }),
        task({ status: 'done', completed_at: yesterday.toISOString() }),
      ]),
    ).toBe(1)
  })
})
