import type { Database } from './database.types'

type T = Database['public']['Tables']
type V = Database['public']['Views']

export type Task = T['tasks']['Row']
export type TaskInsert = T['tasks']['Insert']
export type TaskUpdate = T['tasks']['Update']

export type Goal = T['goals']['Row']
export type GoalInsert = T['goals']['Insert']
export type GoalUpdate = T['goals']['Update']

export type Session = T['sessions']['Row']
export type SessionInsert = T['sessions']['Insert']

export type Achievement = T['achievements']['Row']
export type ChatMessage = T['chat_messages']['Row']
export type DailyPlan = T['daily_plans']['Row']
export type Settings = T['settings']['Row']
export type CalendarSync = T['calendar_sync']['Row']
export type CalendarEvent = T['calendar_events']['Row']
export type GoalProgress = V['goal_progress']['Row']

export type TaskStatus = Database['public']['Enums']['task_status']
export type TaskPriority = Database['public']['Enums']['task_priority']
export type Recurrence = Database['public']['Enums']['recurrence_type']
export type SessionMode = Database['public']['Enums']['session_mode']

/** Shape of a single item in a daily plan's `items` jsonb array. */
export interface DailyPlanItem {
  task_id: string
  title: string
  scheduled_start: string
  scheduled_end: string
  reason?: string
}

/** A proposed AI tool call awaiting user confirmation. */
export interface ProposedToolCall {
  name:
    | 'add_task'
    | 'complete_task'
    | 'schedule_task'
    | 'edit_task'
    | 'delete_task'
    | 'create_goal'
    | 'edit_goal'
    | 'set_pomodoro'
    | 'update_settings'
    | 'get_progress'
  arguments: Record<string, unknown>
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'عالية',
  med: 'متوسطة',
  low: 'منخفضة',
}

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high: '#e0755f',
  med: '#d6a24a',
  low: '#5a9bd4',
}

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: 'بدون تكرار',
  daily: 'يومي',
  weekly: 'أسبوعي',
  monthly: 'شهري',
}

/** Built-in task categories shown as suggestions; users can add their own. */
export const DEFAULT_CATEGORIES = ['شخصي', 'دراسة', 'منزل', 'عمل', 'صحة'] as const
