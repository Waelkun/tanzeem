import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

export type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthState {
  /** Still resolving the initial session (show a splash, not the login page). */
  loading: boolean
  session: Session | null
  user: User | null
  /** The signed-in user's profile row (role + ai_enabled). Null until loaded. */
  profile: Profile | null
  isAdmin: boolean
  aiEnabled: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  const user = session?.user ?? null

  async function loadProfile(uid: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile(data ?? null)
  }

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session?.user) loadProfile(data.session.user.id).finally(() => active && setLoading(false))
      else setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next?.user) loadProfile(next.user.id)
      else setProfile(null)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value: AuthState = {
    loading,
    session,
    user,
    profile,
    isAdmin: profile?.role === 'admin',
    aiEnabled: !!profile?.ai_enabled,
    refreshProfile: async () => {
      if (user) await loadProfile(user.id)
    },
    signOut: async () => {
      await supabase.auth.signOut()
      setProfile(null)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
