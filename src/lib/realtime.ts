import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { qk } from './queries'

/**
 * Subscribe to Postgres changes and invalidate the matching query cache so a
 * change made on one device shows up on the other. Mounted once at app root.
 */
export function useRealtimeSync() {
  const qc = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('db-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        qc.invalidateQueries({ queryKey: qk.tasks })
        qc.invalidateQueries({ queryKey: qk.goalProgress })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, () => {
        qc.invalidateQueries({ queryKey: qk.goals })
        qc.invalidateQueries({ queryKey: qk.goalProgress })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
        qc.invalidateQueries({ queryKey: qk.sessions })
        qc.invalidateQueries({ queryKey: qk.goalProgress })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'achievements' }, () => {
        qc.invalidateQueries({ queryKey: qk.achievements })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => {
        qc.invalidateQueries({ queryKey: qk.settings })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => {
        qc.invalidateQueries({ queryKey: qk.calendarEvents })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc])
}
