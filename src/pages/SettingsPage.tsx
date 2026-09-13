import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellRinging, CaretLeft, Info, ShieldStar, SignOut, Timer, UserCircle } from '@phosphor-icons/react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { Input } from '@/components/ui/form'
import { useSettings, useUpdateSettings } from '@/lib/queries'
import { enablePush, isPushEnabled, pushSupported } from '@/lib/push'
import { invokeFunction } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

export default function SettingsPage() {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()

  return (
    <div className="max-w-2xl">
      <PageHeader title="الإعدادات" subtitle="خصّص تجربتك" />

      <div className="space-y-4">
        <AccountSection />

        <PomodoroSection />

        {/* Notifications */}
        <Section icon={<BellRinging size={18} weight="fill" />} title="الإشعارات">
          <PushRow />
          <Row label="تذكير المهام" desc="عند اقتراب موعد الاستحقاق">
            <Switch
              checked={settings?.notif_task_reminders ?? false}
              onCheckedChange={(v) => update.mutate({ notif_task_reminders: v })}
            />
          </Row>
          <Row label="تنبيهات البومودورو" desc="نهاية التركيز والاستراحة">
            <Switch
              checked={settings?.notif_pomodoro ?? false}
              onCheckedChange={(v) => update.mutate({ notif_pomodoro: v })}
            />
          </Row>
          <Row label="تذكير خطة اليوم" desc="تنبيه صباحي لإنشاء الخطة">
            <Switch
              checked={settings?.notif_daily_plan ?? false}
              onCheckedChange={(v) => update.mutate({ notif_daily_plan: v })}
            />
          </Row>
        </Section>

        {/* About */}
        <Section icon={<Info size={18} weight="fill" />} title="حول التطبيق">
          <p className="text-sm text-ink-400 leading-relaxed">
            منصة تنظيم — نسخة 0.1. بياناتك خاصة بحسابك وتتزامن بين أجهزتك عبر Supabase عند تسجيل الدخول.
          </p>
          <p className="text-xs text-ink-500 leading-relaxed mt-2">
            ملاحظة أمان: كل مستخدم يرى بياناته فقط. المفاتيح السرية (مزوّدو الذكاء الاصطناعي) محفوظة على
            الخادم فقط.
          </p>
        </Section>
      </div>
    </div>
  )
}

function AccountSection() {
  const { user, profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const meta = (user?.user_metadata ?? {}) as Record<string, string>
  const avatar = meta.avatar_url || meta.picture || ''
  const name = meta.full_name || meta.name || profile?.display_name || user?.email || 'حسابي'

  return (
    <Section icon={<UserCircle size={18} weight="fill" />} title="الحساب">
      <div className="flex items-center gap-3">
        {avatar ? (
          <img src={avatar} alt="" className="h-14 w-14 rounded-2xl object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="grid place-items-center h-14 w-14 rounded-2xl bg-accent-faint text-accent-strong text-xl font-semibold">
            {(name[0] ?? '؟').toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-medium truncate flex items-center gap-2">
            {name}
            {isAdmin && (
              <span className="text-xs rounded-full bg-accent-faint text-accent-strong px-2 py-0.5">مدير</span>
            )}
          </p>
          <p className="text-sm text-ink-400 truncate" dir="ltr">
            {user?.email}
          </p>
          <p className="text-xs text-ink-500 mt-0.5">
            المساعد الذكي: {profile?.ai_enabled ? 'مُفعّل' : 'موقوف'}
          </p>
        </div>
      </div>

      {isAdmin && (
        <button
          onClick={() => navigate('/admin')}
          className="mt-1 w-full flex items-center justify-between gap-3 rounded-2xl px-3 py-3 glass-soft hover:bg-white/[0.06] transition-colors focus-ring"
        >
          <span className="flex items-center gap-2.5 text-ink-100">
            <ShieldStar size={18} weight="fill" className="text-accent-strong" />
            <span className="text-sm font-medium">لوحة الإدارة</span>
          </span>
          <CaretLeft size={16} className="text-ink-500" />
        </button>
      )}

      <div className="pt-1">
        <Button variant="ghost" size="sm" onClick={signOut}>
          <SignOut size={16} />
          تسجيل الخروج
        </Button>
      </div>
    </Section>
  )
}

function PomodoroSection() {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  const [local, setLocal] = useState({ focus: 25, brk: 5, long: 15, cycles: 4 })

  useEffect(() => {
    if (settings)
      setLocal({
        focus: settings.pomodoro_focus_min,
        brk: settings.pomodoro_break_min,
        long: settings.pomodoro_long_break_min,
        cycles: settings.pomodoro_cycles,
      })
  }, [settings])

  // Never let an empty/NaN field reach the store — a NaN target would freeze the timer.
  const clamp = (n: number, min = 1) => (Number.isFinite(n) && n >= min ? Math.floor(n) : min)
  const save = () =>
    update.mutate({
      pomodoro_focus_min: clamp(local.focus),
      pomodoro_break_min: clamp(local.brk),
      pomodoro_long_break_min: clamp(local.long),
      pomodoro_cycles: clamp(local.cycles),
    })

  return (
    <Section icon={<Timer size={18} weight="fill" />} title="البومودورو">
      <div className="grid grid-cols-2 gap-3">
        <NumField label="تركيز (دقيقة)" value={local.focus} onChange={(v) => setLocal((s) => ({ ...s, focus: v }))} />
        <NumField label="استراحة (دقيقة)" value={local.brk} onChange={(v) => setLocal((s) => ({ ...s, brk: v }))} />
        <NumField label="استراحة طويلة" value={local.long} onChange={(v) => setLocal((s) => ({ ...s, long: v }))} />
        <NumField label="عدد الدورات" value={local.cycles} onChange={(v) => setLocal((s) => ({ ...s, cycles: v }))} />
      </div>
      <Button variant="soft" size="sm" className="mt-3" onClick={save} disabled={update.isPending}>
        حفظ إعدادات البومودورو
      </Button>
    </Section>
  )
}

function PushRow() {
  const [enabled, setEnabled] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => {
    isPushEnabled().then(setEnabled)
  }, [])

  const turnOn = async () => {
    const res = await enablePush()
    setEnabled(res.ok)
    setMsg(res.ok ? 'تم تفعيل الإشعارات على هذا الجهاز' : res.reason ?? 'تعذّر التفعيل')
  }

  const test = async () => {
    setMsg('جارٍ الإرسال…')
    try {
      await invokeFunction('send-push', {
        title: 'منصة تنظيم',
        body: 'هذا إشعار تجريبي من التطبيق',
      })
      setMsg('أُرسل الإشعار التجريبي')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'تعذّر الإرسال')
    }
  }

  return (
    <Row label="إشعارات هذا الجهاز" desc={msg || (enabled ? 'مفعّلة' : pushSupported() ? 'غير مفعّلة' : 'غير مدعومة')}>
      {enabled ? (
        <Button variant="glass" size="sm" onClick={test}>
          إشعار تجريبي
        </Button>
      ) : (
        <Button variant="soft" size="sm" onClick={turnOn} disabled={!pushSupported()}>
          تفعيل
        </Button>
      )}
    </Row>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="grid place-items-center h-8 w-8 rounded-xl bg-white/[0.06] text-ink-200">{icon}</span>
        <h3 className="font-semibold tracking-tight">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-ink-100">{label}</p>
        {desc && <p className="text-xs text-ink-500 mt-0.5">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-ink-400">{label}</span>
      <Input type="number" min={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="nums" />
    </label>
  )
}
