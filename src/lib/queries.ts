import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from '@/features/auth/AuthProvider'
import type {
  Achievement,
  CalendarEvent,
  Goal,
  GoalInsert,
  GoalProgress,
  Session,
  SessionInsert,
  Settings,
  Task,
  TaskInsert,
  TaskUpdate,
} from './types'

export const qk = {
  tasks: ['tasks'] as const,
  goals: ['goals'] as const,
  goalProgress: ['goal_progress'] as const,
  sessions: ['sessions'] as const,
  achievements: ['achievements'] as const,
  settings: ['settings'] as const,
  calendarEvents: ['calendar_events'] as const,
}

/* ---------------- TASKS ---------------- */
export function useTasks() {
  return useQuery({
    queryKey: qk.tasks,
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (task: TaskInsert): Promise<Task> => {
      const { data, error } = await supabase.from('tasks').insert(task).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.tasks }),
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TaskUpdate }): Promise<Task> => {
      const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tasks })
      qc.invalidateQueries({ queryKey: qk.goalProgress })
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.tasks }),
  })
}

/* ---------------- GOALS ---------------- */
export function useGoals() {
  return useQuery({
    queryKey: qk.goals,
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('archived', false)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useGoalProgress() {
  return useQuery({
    queryKey: qk.goalProgress,
    queryFn: async (): Promise<GoalProgress[]> => {
      const { data, error } = await supabase.from('goal_progress').select('*')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (goal: GoalInsert): Promise<Goal> => {
      const { data, error } = await supabase.from('goals').insert(goal).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.goals })
      qc.invalidateQueries({ queryKey: qk.goalProgress })
    },
  })
}

export function useUpdateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Goal> }): Promise<Goal> => {
      const { data, error } = await supabase.from('goals').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.goals })
      qc.invalidateQueries({ queryKey: qk.goalProgress })
    },
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('goals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.goals })
      qc.invalidateQueries({ queryKey: qk.goalProgress })
    },
  })
}

/* ---------------- SESSIONS ---------------- */
export function useSessions(limit = 500) {
  return useQuery({
    queryKey: qk.sessions,
    queryFn: async (): Promise<Session[]> => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useLogSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (s: SessionInsert): Promise<Session> => {
      const { data, error } = await supabase.from('sessions').insert(s).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.sessions })
      qc.invalidateQueries({ queryKey: qk.goalProgress })
    },
  })
}

export function useUpdateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Session> }): Promise<Session> => {
      const { data, error } = await supabase.from('sessions').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.sessions })
      qc.invalidateQueries({ queryKey: qk.goalProgress })
    },
  })
}

export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sessions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.sessions })
      qc.invalidateQueries({ queryKey: qk.goalProgress })
    },
  })
}

/* ---------------- ACHIEVEMENTS ---------------- */
export function useAchievements() {
  return useQuery({
    queryKey: qk.achievements,
    queryFn: async (): Promise<Achievement[]> => {
      const { data, error } = await supabase
        .from('achievements')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useAddAchievement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { text: string; task_id?: string | null }): Promise<Achievement> => {
      const { data, error } = await supabase.from('achievements').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.achievements }),
  })
}

export function useDeleteAchievement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('achievements').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.achievements }),
  })
}

/* ---------------- CALENDAR EVENTS (read-only busy blocks) ---------------- */
export function useCalendarEvents() {
  return useQuery({
    queryKey: qk.calendarEvents,
    queryFn: async (): Promise<CalendarEvent[]> => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .order('start_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

/* ---------------- SETTINGS (one row per user, keyed by user_id) ---------------- */
export function useSettings() {
  const { user } = useAuth()
  const uid = user?.id
  return useQuery({
    queryKey: [...qk.settings, uid],
    enabled: !!uid,
    queryFn: async (): Promise<Settings | null> => {
      const { data, error } = await supabase.from('settings').select('*').eq('user_id', uid!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const uid = user?.id
  return useMutation({
    mutationFn: async (patch: Partial<Settings>): Promise<Settings> => {
      // Upsert so the user's row is created on first change and updated after.
      const { data, error } = await supabase
        .from('settings')
        .upsert({ user_id: uid!, ...patch }, { onConflict: 'user_id' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => qc.setQueryData([...qk.settings, uid], data),
  })
}
