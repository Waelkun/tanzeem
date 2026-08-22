import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { DownloadSimple, X } from '@phosphor-icons/react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'tanzeem-install-dismissed'

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setShow(false)
    setDeferred(null)
  }

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setShow(false)
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="fixed z-30 bottom-4 start-4 hidden md:flex items-center gap-3 glass rounded-2xl p-3 pe-4 max-w-sm"
        >
          <span className="grid place-items-center h-10 w-10 rounded-xl bg-accent text-ink-950 shrink-0">
            <DownloadSimple size={20} weight="bold" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">ثبّت «تنظيم» على جهازك</p>
            <p className="text-xs text-ink-400">وصول أسرع وتجربة كتطبيق مستقل</p>
          </div>
          <button onClick={install} className="shrink-0 h-9 px-3 rounded-xl bg-accent text-ink-950 text-sm font-medium active:scale-95 transition-transform">
            تثبيت
          </button>
          <button onClick={dismiss} aria-label="إغلاق" className="shrink-0 grid place-items-center h-8 w-8 rounded-lg text-ink-400 hover:bg-white/[0.08] transition-colors">
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
