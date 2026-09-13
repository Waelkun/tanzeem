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
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          task_id?: string | null
          text: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          task_id?: string | null
          text?: string
          user_id?: string | null
        }
        Relationships: []
      }
      active_timer: {
        Row: {
          base_elapsed: number
          completed_focus: number
          id: number
          mode: string
          phase: string
          phase_started_at: string | null
          segment_start: number | null
          status: string
          task_id: string | null
          task_title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          base_elapsed?: number
          completed_focus?: number
          id?: number
          mode?: string
          phase?: string
          phase_started_at?: string | null
          segment_start?: number | null
          status?: string
          task_id?: string | null
          task_title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          base_elapsed?: number
          completed_focus?: number
          id?: number
          mode?: string
          phase?: string
          phase_started_at?: string | null
          segment_start?: number | null
          status?: string
          task_id?: string | null
          task_title?: string | null
          updated_at?: string
          user_id?: string | null
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
          provider: string | null
          role: Database['public']['Enums']['chat_role']
          tool_call: Json | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          provider?: string | null
          role: Database['public']['Enums']['chat_role']
          tool_call?: Json | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          provider?: string | null
          role?: Database['public']['Enums']['chat_role']
          tool_call?: Json | null
          user_id?: string | null
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
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          plan_date: string
          status?: Database['public']['Enums']['plan_status']
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          plan_date?: string
          status?: Database['public']['Enums']['plan_status']
          user_id?: string | null
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
          user_id: string | null
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          target_hours?: number
          title: string
          user_id?: string | null
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          target_hours?: number
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ai_enabled: boolean
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          role: string
        }
        Insert: {
          ai_enabled?: boolean
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          role?: string
        }
        Update: {
          ai_enabled?: boolean
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          role?: string
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
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          endpoint: string
          id?: string
          keys: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_label?: string | null
          endpoint?: string
          id?: string
          keys?: Json
          user_id?: string | null
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
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          mode?: Database['public']['Enums']['session_mode']
          started_at?: string
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          mode?: Database['public']['Enums']['session_mode']
          started_at?: string
          task_id?: string | null
          user_id?: string | null
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
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
    Functions: {
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      admin_set_ai_enabled: {
        Args: { target: string; val: boolean }
        Returns: undefined
      }
      admin_user_stats: {
        Args: Record<string, never>
        Returns: {
          id: string
          email: string | null
          display_name: string | null
          role: string
          ai_enabled: boolean
          created_at: string
          tasks: number
          sessions: number
          achievements: number
          goals: number
          chat_messages: number
          daily_plans: number
          tracked_seconds: number
          est_bytes: number
        }[]
      }
    }
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
