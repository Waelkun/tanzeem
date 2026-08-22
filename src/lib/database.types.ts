export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.15'
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          created_at: string
          id: string
          task_id: string | null
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          task_id?: string | null
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          task_id?: string | null
          text?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          end_at: string
          google_id: string
          id: string
          start_at: string
          title: string | null
          updated_at: string
        }
        Insert: {
          end_at: string
          google_id: string
          id?: string
          start_at: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          end_at?: string
          google_id?: string
          id?: string
          start_at?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      calendar_sync: {
        Row: {
          access_token: string | null
          connected_email: string | null
          id: number
          last_synced_at: string | null
          refresh_token: string | null
          token_expiry: string | null
        }
        Insert: {
          access_token?: string | null
          connected_email?: string | null
          id?: number
          last_synced_at?: string | null
          refresh_token?: string | null
          token_expiry?: string | null
        }
        Update: {
          access_token?: string | null
          connected_email?: string | null
          id?: number
          last_synced_at?: string | null
          refresh_token?: string | null
          token_expiry?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: Database['public']['Enums']['chat_role']
          tool_call: Json | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: Database['public']['Enums']['chat_role']
          tool_call?: Json | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: Database['public']['Enums']['chat_role']
          tool_call?: Json | null
        }
        Relationships: []
      }
      daily_plans: {
        Row: {
          created_at: string
          id: string
          items: Json
          plan_date: string
          status: Database['public']['Enums']['plan_status']
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          plan_date: string
          status?: Database['public']['Enums']['plan_status']
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          plan_date?: string
          status?: Database['public']['Enums']['plan_status']
        }
        Relationships: []
      }
      goals: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          description: string | null
          id: string
          target_hours: number
          title: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          target_hours?: number
          title: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          target_hours?: number
          title?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          device_label: string | null
          endpoint: string
          id: string
          keys: Json
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          endpoint: string
          id?: string
          keys: Json
        }
        Update: {
          created_at?: string
          device_label?: string | null
          endpoint?: string
          id?: string
          keys?: Json
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          duration_seconds: number
          ended_at: string | null
          id: string
          mode: Database['public']['Enums']['session_mode']
          started_at: string
          task_id: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          mode?: Database['public']['Enums']['session_mode']
          started_at?: string
          task_id?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          mode?: Database['public']['Enums']['session_mode']
          started_at?: string
          task_id?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          cal_pull_from_google: boolean
          cal_push_to_google: boolean
          id: number
          notif_daily_plan: boolean
          notif_pomodoro: boolean
          notif_task_reminders: boolean
          pomodoro_break_min: number
          pomodoro_cycles: number
          pomodoro_focus_min: number
          pomodoro_long_break_min: number
          theme: string
          timezone: string
          updated_at: string
        }
        Insert: {
          cal_pull_from_google?: boolean
          cal_push_to_google?: boolean
          id?: number
          notif_daily_plan?: boolean
          notif_pomodoro?: boolean
          notif_task_reminders?: boolean
          pomodoro_break_min?: number
          pomodoro_cycles?: number
          pomodoro_focus_min?: number
          pomodoro_long_break_min?: number
          theme?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          cal_pull_from_google?: boolean
          cal_push_to_google?: boolean
          id?: number
          notif_daily_plan?: boolean
          notif_pomodoro?: boolean
          notif_task_reminders?: boolean
          pomodoro_break_min?: number
          pomodoro_cycles?: number
          pomodoro_focus_min?: number
          pomodoro_long_break_min?: number
          theme?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          category: string | null
          completed_at: string | null
          created_at: string
          due_date: string | null
          goal_id: string | null
          google_event_id: string | null
          id: string
          notes: string | null
          priority: Database['public']['Enums']['task_priority']
          recurrence: Database['public']['Enums']['recurrence_type']
          reminder_sent: boolean
          scheduled_end: string | null
          scheduled_start: string | null
          sort_order: number
          status: Database['public']['Enums']['task_status']
          title: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          goal_id?: string | null
          google_event_id?: string | null
          id?: string
          notes?: string | null
          priority?: Database['public']['Enums']['task_priority']
          recurrence?: Database['public']['Enums']['recurrence_type']
          reminder_sent?: boolean
          scheduled_end?: string | null
          scheduled_start?: string | null
          sort_order?: number
          status?: Database['public']['Enums']['task_status']
          title: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          goal_id?: string | null
          google_event_id?: string | null
          id?: string
          notes?: string | null
          priority?: Database['public']['Enums']['task_priority']
          recurrence?: Database['public']['Enums']['recurrence_type']
          reminder_sent?: boolean
          scheduled_end?: string | null
          scheduled_start?: string | null
          sort_order?: number
          status?: Database['public']['Enums']['task_status']
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      goal_progress: {
        Row: {
          accumulated_hours: number | null
          color: string | null
          done_tasks: number | null
          goal_id: string | null
          target_hours: number | null
          tasks_percent: number | null
          title: string | null
          total_tasks: number | null
        }
        Relationships: []
      }
    }
    Functions: Record<string, never>
    Enums: {
      chat_role: 'user' | 'assistant'
      plan_status: 'proposed' | 'accepted' | 'rejected'
      recurrence_type: 'none' | 'daily' | 'weekly' | 'monthly'
      session_mode: 'timer' | 'pomodoro'
      task_priority: 'low' | 'med' | 'high'
      task_status: 'todo' | 'doing' | 'done'
    }
    CompositeTypes: Record<string, never>
  }
}
