import { useState } from 'react'
import { Sparkle, EnvelopeSimple, GoogleLogo, CheckCircle } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setStatus('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setError(error.message)
      setStatus('idle')
    } else {
      setStatus('sent')
    }
  }

  async function signInWithGoogle() {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-[100dvh] grid place-items-center px-4">
      <div className="w-full max-w-sm glass-soft rounded-3xl p-8">
        <div className="flex flex-col items-center text-center gap-3 mb-8">
          <div className="grid place-items-center h-14 w-14 rounded-2xl bg-accent text-ink-950 shadow-[0_8px_20px_-8px_rgba(52,185,138,0.6)]">
            <Sparkle size={28} weight="fill" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">تنظيم</h1>
            <p className="text-sm text-ink-400 mt-1">سجّل الدخول للمتابعة إلى حسابك</p>
          </div>
        </div>

        {status === 'sent' ? (
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <CheckCircle size={40} weight="fill" className="text-accent-strong" />
            <p className="font-medium">تفقّد بريدك الإلكتروني</p>
            <p className="text-sm text-ink-400 leading-relaxed">
              أرسلنا رابط تسجيل الدخول إلى <span className="text-ink-200">{email}</span>. افتح الرابط من
              نفس الجهاز لإكمال الدخول.
            </p>
            <button
              onClick={() => setStatus('idle')}
              className="mt-2 text-sm text-accent-strong hover:underline focus-ring rounded-lg px-2 py-1"
            >
              استخدام بريد آخر
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-white text-ink-950 font-medium py-3 hover:bg-white/90 transition-colors focus-ring"
            >
              <GoogleLogo size={20} weight="bold" />
              المتابعة عبر Google
            </button>

            <div className="flex items-center gap-3 my-5 text-ink-500 text-xs">
              <span className="h-px flex-1 bg-white/[0.08]" />
              أو
              <span className="h-px flex-1 bg-white/[0.08]" />
            </div>

            <form onSubmit={sendLink} className="flex flex-col gap-3">
              <div className="relative">
                <EnvelopeSimple
                  size={18}
                  className="absolute top-1/2 -translate-y-1/2 end-3 text-ink-500 pointer-events-none"
                />
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-2xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 pe-10 text-start outline-none focus:border-accent focus-ring"
                />
              </div>
              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full rounded-2xl bg-accent text-ink-950 font-medium py-3 hover:brightness-105 transition disabled:opacity-60 focus-ring"
              >
                {status === 'sending' ? 'جارٍ الإرسال…' : 'إرسال رابط الدخول'}
              </button>
            </form>

            <p className="text-xs text-ink-500 text-center mt-5 leading-relaxed">
              بالمتابعة فإنك توافق على استخدام المنصة. سيصلك رابط تأكيد على بريدك عند أول دخول.
            </p>
          </>
        )}

        {error && <p className="text-sm text-red-400 text-center mt-4">{error}</p>}
      </div>
    </div>
  )
}
