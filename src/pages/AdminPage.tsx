import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldStar, Sparkle, Users, ListChecks, Clock, Database } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import type { Database as DB } from '@/lib/database.types'
import { useAuth } from '@/features/auth/AuthProvider'

type UserStat = DB['public']['Functions']['admin_user_stats']['Returns'][number]

function useUserStats() {
  return useQuery({
    queryKey: ['admin_user_stats'],
    queryFn: async (): Promise<UserStat[]> => {
      const { data, error } = await supabase.rpc('admin_user_stats')
      if (error) throw error
      return (data ?? []) as UserStat[]
    },
  })
}

const fmtHours = (secs: number) => `${Math.round((secs / 3600) * 10) / 10} س`
function fmtBytes(b: number): string {
  if (b < 1024) return `${b} ب`
  if (b < 1024 * 1024) return `${Math.round(b / 102.4) / 10} ك.ب`
  return `${Math.round(b / (1024 * 104.857)) / 10} م.ب`
}
const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))

export default function AdminPage() {
  const { user } = useAuth()
  const { data: stats, isLoading } = useUserStats()
  const qc = useQueryClient()

  const toggleAi = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      // Goes through a SECURITY DEFINER function that verifies the caller is an
      // admin, so users can never flip their own AI access directly.
      const { error } = await supabase.rpc('admin_set_ai_enabled', { target: id, val: next })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin_user_stats'] }),
  })

  const totals = useMemo(() => {
    const s = stats ?? []
    return {
      users: s.length,
      tasks: s.reduce((a, u) => a + u.tasks, 0),
      seconds: s.reduce((a, u) => a + u.tracked_seconds, 0),
      bytes: s.reduce((a, u) => a + u.est_bytes, 0),
    }
  }, [stats])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <div className="grid place-items-center h-11 w-11 rounded-2xl bg-accent-faint text-accent-strong">
          <ShieldStar size={22} weight="fill" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">الإدارة</h1>
          <p className="text-sm text-ink-400">المستخدمون، استهلاكهم للبيانات، والتحكّم في المساعد الذكي</p>
        </div>
      </header>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Users size={18} weight="fill" />} label="المستخدمون" value={String(totals.users)} />
        <StatCard icon={<ListChecks size={18} weight="fill" />} label="إجمالي المهام" value={String(totals.tasks)} />
        <StatCard icon={<Clock size={18} weight="fill" />} label="إجمالي الوقت" value={fmtHours(totals.seconds)} />
        <StatCard icon={<Database size={18} weight="fill" />} label="حجم البيانات" value={fmtBytes(totals.bytes)} />
      </div>

      {isLoading ? (
        <p className="text-ink-400 text-sm">جارٍ التحميل…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {(stats ?? []).map((u) => {
            const isMe = u.id === user?.id
            const busy = toggleAi.isPending && toggleAi.variables?.id === u.id
            return (
              <div key={u.id} className="glass-soft rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {u.display_name || u.email || 'مستخدم'}
                      {u.role === 'admin' && (
                        <span className="ms-2 text-xs rounded-full bg-accent-faint text-accent-strong px-2 py-0.5">مدير</span>
                      )}
                      {isMe && <span className="ms-2 text-xs text-ink-500">(أنت)</span>}
                    </p>
                    <p className="text-sm text-ink-400 truncate" dir="ltr">{u.email}</p>
                    <p className="text-xs text-ink-500 mt-0.5">انضمّ في {fmtDate(u.created_at)}</p>
                  </div>
                  <button
                    onClick={() => toggleAi.mutate({ id: u.id, next: !u.ai_enabled })}
                    disabled={busy}
                    className={
                      'shrink-0 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-ring disabled:opacity-60 ' +
                      (u.ai_enabled
                        ? 'bg-accent text-ink-950 hover:brightness-105'
                        : 'bg-white/[0.05] text-ink-300 hover:bg-white/[0.08]')
                    }
                  >
                    <Sparkle size={16} weight={u.ai_enabled ? 'fill' : 'regular'} />
                    {u.ai_enabled ? 'الذكاء مُفعّل' : 'الذكاء موقوف'}
                  </button>
                </div>

                {/* Per-user usage */}
                <div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                  <Metric label="مهام" value={u.tasks} />
                  <Metric label="جلسات" value={u.sessions} />
                  <Metric label="ساعات" value={fmtHours(u.tracked_seconds)} />
                  <Metric label="إنجازات" value={u.achievements} />
                  <Metric label="أهداف" value={u.goals} />
                  <Metric label="الحجم" value={fmtBytes(u.est_bytes)} />
                </div>
              </div>
            )
          })}
          {(stats ?? []).length === 0 && <p className="text-ink-400 text-sm">لا يوجد مستخدمون بعد.</p>}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass-soft rounded-2xl p-4">
      <div className="flex items-center gap-2 text-ink-400 text-xs mb-1.5">
        <span className="text-accent-strong">{icon}</span>
        {label}
      </div>
      <p className="text-lg font-semibold tracking-tight nums">{value}</p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink-100 nums">{value}</p>
      <p className="text-[11px] text-ink-500 mt-0.5">{label}</p>
    </div>
  )
}
