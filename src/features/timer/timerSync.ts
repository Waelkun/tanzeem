// Cross-device timer sync. A single shared `active_timer` row (id = 1) is the
// source of truth for "the timer that is currently running", so starting on the
// phone shows the same live timer on the laptop, and stopping on one device
// stops it everywhere. Elapsed time stays correct across devices because it is
// derived from `segment_start` (an absolute epoch-ms timestamp), not a counter.
//
// Flow:
//   • local → server: subscribe to the store; every genuine timer transition
//     (start/pause/resume/stop/phase change) writes the row.
//   • server → local: a realtime subscription mirrors remote changes into the
//     store. An `applyingRemote` guard stops that from echoing back as a push.
//   • pomodoro auto-transitions fire on every open device, so `advanceTimer`
//     does an atomic compare-and-swap on `phase_started_at` — only one device
//     wins the right to log the finished focus block and advance the phase.
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTimerStore, type TimerState } from '@/store/timerStore'
import { useAuth } from '@/features/auth/AuthProvider'
import type { Database } from '@/lib/database.types'

type Row = Database['public']['Tables']['active_timer']['Row']

// The signed-in user's id. Each user owns exactly one `active_timer` row, so
// this scopes every read/write below. Set by `useTimerSync` on mount; the
// module-level functions (`pushTimer`/`advanceTimer`) read it so their external
// call sites don't need to thread the id through.
let currentUserId: string | null = null

/** The store fields that make up the shared timer (config stays device-local). */
export type TimerSyncState = Pick<
  TimerState,
  | 'status'
  | 'mode'
  | 'taskId'
  | 'taskTitle'
  | 'segmentStart'
  | 'baseElapsed'
  | 'phase'
  | 'completedFocus'
  | 'phaseStartedAtISO'
>

// True while we are writing a server row into the store, so the store
// subscription below doesn't treat that write as a local change and echo it.
let applyingRemote = false

const pick = (s: TimerSyncState): TimerSyncState => ({
  status: s.status,
  mode: s.mode,
  taskId: s.taskId,
  taskTitle: s.taskTitle,
  segmentStart: s.segmentStart,
  baseElapsed: s.baseElapsed,
  phase: s.phase,
  completedFocus: s.completedFocus,
  phaseStartedAtISO: s.phaseStartedAtISO,
})
const keyOf = (s: TimerSyncState) => JSON.stringify(pick(s))

function rowToState(r: Row): TimerSyncState {
  return {
    status: r.status as TimerState['status'],
    mode: r.mode as TimerState['mode'],
    taskId: r.task_id,
    taskTitle: r.task_title,
    segmentStart: r.segment_start,
    baseElapsed: r.base_elapsed,
    phase: r.phase as TimerState['phase'],
    completedFocus: r.completed_focus,
    phaseStartedAtISO: r.phase_started_at,
  }
}

function stateToRow(s: TimerSyncState) {
  return {
    status: s.status,
    mode: s.mode,
    task_id: s.taskId,
    task_title: s.taskTitle,
    segment_start: s.segmentStart,
    base_elapsed: s.baseElapsed,
    phase: s.phase,
    completed_focus: s.completedFocus,
    phase_started_at: s.phaseStartedAtISO,
    updated_at: new Date().toISOString(),
  }
}

/** Write the current shared timer state to this user's row. Best-effort. */
async function pushTimer(s: TimerSyncState) {
  if (!currentUserId) return
  try {
    // Upsert so the row is created on first use and updated thereafter.
    await supabase
      .from('active_timer')
      .upsert({ user_id: currentUserId, ...stateToRow(s) }, { onConflict: 'user_id' })
  } catch {
    /* offline / transient — a later transition or realtime reconnect reconciles */
  }
}

/** Apply a shared state into the store without echoing it back to the server. */
function applyLocal(next: TimerSyncState) {
  if (keyOf(useTimerStore.getState()) === keyOf(next)) return
  applyingRemote = true
  useTimerStore.setState(next)
  applyingRemote = false
}

/**
 * Atomically claim a pomodoro phase transition. Every open device's engine
 * reaches the boundary at the same time; the UPDATE is conditioned on the phase
 * we're leaving (`fromISO`), so exactly one device matches the row and wins —
 * the rest get zero rows back and skip logging (they receive the new phase via
 * realtime). On a network error we assume a single device and let it proceed.
 * Returns true if THIS device should log the finished block and advance locally.
 */
export async function advanceTimer(fromISO: string | null, next: TimerSyncState): Promise<boolean> {
  if (!fromISO || !currentUserId) {
    // No token to compare against (shouldn't happen mid-pomodoro) — act locally.
    void pushTimer(next)
    return true
  }
  try {
    const { data, error } = await supabase
      .from('active_timer')
      .update(stateToRow(next))
      .eq('user_id', currentUserId)
      .eq('phase_started_at', fromISO)
      .select('id')
    if (error) return true
    return (data?.length ?? 0) > 0
  } catch {
    return true
  }
}

/** Mirror the just-won transition into this device's store (no re-push). */
export function applyAdvanced(next: TimerSyncState) {
  applyLocal(next)
}

/**
 * Mount once at the app root. Hydrates from the shared row, then keeps the store
 * and the row mirrored in both directions.
 */
export function useTimerSync() {
  const { user } = useAuth()
  const uid = user?.id ?? null

  useEffect(() => {
    currentUserId = uid
    if (!uid) return
    let cancelled = false

    // Initial hydrate: this user's server row is the source of truth. If it says
    // idle, a stale local timer is cleared; if it has a running timer, adopt it.
    supabase
      .from('active_timer')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) applyLocal(rowToState(data as Row))
      })

    // local → server: push on any genuine change to the shared fields.
    const unsubscribe = useTimerStore.subscribe((state, prev) => {
      if (applyingRemote) return
      if (keyOf(state) === keyOf(prev)) return
      void pushTimer(pick(state))
    })

    // server → local: mirror this user's remote changes (other devices) into the
    // store. RLS already limits delivery to the user's own row; the explicit
    // filter is belt-and-suspenders.
    const channel = supabase
      .channel(`active-timer-${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'active_timer', filter: `user_id=eq.${uid}` },
        (payload) => {
          const r = payload.new as Row
          if (r && r.user_id === uid) applyLocal(rowToState(r))
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      unsubscribe()
      supabase.removeChannel(channel)
    }
  }, [uid])
}
