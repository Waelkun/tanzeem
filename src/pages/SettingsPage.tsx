import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BellRinging, CalendarBlank, GoogleLogo, Info, Timer } from '@phosphor-icons/react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { Input } from '@/components/ui/form'
import { useSettings, useUpdateSettings } from '@/lib/queries'
import { enablePush, isPushEnabled, pushSupported } from '@/lib/push'
import { connectGoogle, disconnectGoogle, syncNow } from '@/lib/gcal'
import { supabase, invokeFunction } from '@/lib/supabase'
import { relative } from '@/lib/dates'

export default function SettingsPage() {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()

  return (
    <div className="max-w-2xl">
      <PageHeader title="الإعدادات" subtitle="خصّص تجربتك" />

      <div className="space-y-4">
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

        <CalendarSection />

        {/* About */}
        <Section icon={<Info size={18} weight="fill" />} title="حول التطبيق">
          <p className="text-sm text-ink-400 leading-relaxed">
            منصة تنظيم — نسخة 0.1. تطبيق شخصي بدون تسجيل دخول؛ تتزامن بياناتك بين أجهزتك عبر Supabase.
          </p>
          <p className="text-xs text-ink-500 leading-relaxed mt-2">
            ملاحظة أمان: بما أنه لا يوجد تسجيل دخول، يمكن لأي شخص يملك رابط التطبيق ومفتاحه العام الوصول إلى
            البيانات. المفاتيح السرية (NVIDIA وGoogle) محفوظة على الخادم فقط.
          </p>
        </Section>
      </div>
    </div>
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

function CalendarSection() {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const { data: cal } = useQuery({
    queryKey: ['calendar_sync'],
    queryFn: async () => {
      const { data } = await supabase.from('calendar_sync').select('*').eq('id', 1).single()
      return data
    },
  })
  const connected = !!cal?.connected_email

  const doSync = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      const r = await syncNow()
      setSyncMsg(`تمت المزامنة — أُرسل ${r.pushed}، استُلم ${r.pulled}`)
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : 'تعذّرت المزامنة')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Section icon={<CalendarBlank size={18} weight="fill" />} title="تقويم Google">
      {connected ? (
        <>
          <Row label="متصل" desc={cal!.connected_email ?? ''}>
            <Button variant="ghost" size="sm" onClick={() => disconnectGoogle().then(() => location.reload())}>
              فصل
            </Button>
          </Row>
          <Row label="دفع المهام إلى Google" desc="المهام ذات المواعيد تُصبح أحداثاً">
            <Switch checked={settings?.cal_push_to_google ?? false} onCheckedChange={(v) => update.mutate({ cal_push_to_google: v })} />
          </Row>
          <Row label="سحب أحداث Google" desc="تظهر كأوقات مشغولة في الجدول">
            <Switch checked={settings?.cal_pull_from_google ?? false} onCheckedChange={(v) => update.mutate({ cal_pull_from_google: v })} />
          </Row>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-ink-500">
              {cal?.last_synced_at ? `آخر مزامنة ${relative(cal.last_synced_at)}` : 'لم تتم مزامنة بعد'}
            </span>
            <Button variant="soft" size="sm" onClick={doSync} disabled={syncing}>
              {syncing ? 'يزامن…' : 'زامن الآن'}
            </Button>
          </div>
          {syncMsg && <p className="text-xs text-ink-400 mt-1">{syncMsg}</p>}
        </>
      ) : (
        <Row label="غير متصل" desc="اربط تقويمك لمزامنة المهام والأحداث">
          <Button variant="soft" size="sm" onClick={connectGoogle}>
            <GoogleLogo size={16} weight="bold" />
            ربط
          </Button>
        </Row>
      )}
    </Section>
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
