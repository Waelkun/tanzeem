import { useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarBlank,
  ChartLineUp,
  CheckCircle,
  Gear,
  House,
  Sparkle,
  Target,
  Timer as TimerIcon,
  Trophy,
} from '@phosphor-icons/react'
import { cn } from '@/lib/cn'
import { useRealtimeSync } from '@/lib/realtime'
import { TimerEngine } from '@/features/timer/TimerEngine'
import { RunningBar } from '@/features/timer/RunningBar'
import { AISidePanel } from '@/features/ai/AISidePanel'
import { InstallPrompt } from '@/components/InstallPrompt'
import Today from '@/pages/Today'
import Tasks from '@/pages/Tasks'
import Schedule from '@/pages/Schedule'
import Goals from '@/pages/Goals'
import TimerPage from '@/pages/TimerPage'
import Summary from '@/pages/Summary'
import Achievements from '@/pages/Achievements'
import SettingsPage from '@/pages/SettingsPage'

const NAV = [
  { to: '/', label: 'اليوم', icon: House, end: true },
  { to: '/tasks', label: 'المهام', icon: CheckCircle },
  { to: '/schedule', label: 'الجدول', icon: CalendarBlank },
  { to: '/goals', label: 'الأهداف', icon: Target },
  { to: '/achievements', label: 'الإنجازات', icon: Trophy },
  { to: '/timer', label: 'المؤقّت', icon: TimerIcon },
  { to: '/summary', label: 'الملخص', icon: ChartLineUp },
]

// The mobile bottom bar is the only nav on phones (the sidebar is desktop-only),
// so Settings must live here too — otherwise it's unreachable on mobile.
const MOBILE_NAV = [...NAV, { to: '/settings', label: 'الإعدادات', icon: Gear }]

export default function App() {
  useRealtimeSync()
  const [aiOpen, setAiOpen] = useState(false)

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row">
      <TimerEngine />

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 shrink-0 flex-col gap-2 p-4 border-e border-white/[0.06]">
        <div className="flex items-center gap-3 px-2 py-4">
          <div className="grid place-items-center h-10 w-10 rounded-2xl bg-accent text-ink-950 shadow-[0_8px_20px_-8px_rgba(52,185,138,0.6)]">
            <Sparkle size={22} weight="fill" />
          </div>
          <div>
            <p className="font-semibold tracking-tight leading-none">تنظيم</p>
            <p className="text-xs text-ink-400 mt-1">مهامك ووقتك وأهدافك</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 mt-2">
          {NAV.map((item) => (
            <SideLink key={item.to} {...item} />
          ))}
          <SideLink to="/settings" label="الإعدادات" icon={Gear} />
        </nav>

        <button
          onClick={() => setAiOpen(true)}
          className="mt-auto glass-soft rounded-2xl p-4 text-start hover:bg-white/[0.06] transition-colors focus-ring group"
        >
          <div className="flex items-center gap-2 text-accent-strong">
            <Sparkle size={18} weight="fill" />
            <span className="font-medium text-sm">المساعد الذكي</span>
          </div>
          <p className="text-xs text-ink-400 mt-1.5 leading-relaxed">
            اسأل عن تقدّمك أو اطلب خطة اليوم
          </p>
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 pb-28 md:pb-0">
        <div className="mx-auto max-w-5xl px-4 md:px-8 py-6 md:py-10">
          <Routes>
            <Route path="/" element={<Today onOpenAI={() => setAiOpen(true)} />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/timer" element={<TimerPage />} />
            <Route path="/summary" element={<Summary />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>

      {/* Running-timer floating bar */}
      <RunningBar />

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 glass border-t border-white/[0.08] px-1 pb-[env(safe-area-inset-bottom)]">
        <div
          className="grid gap-0.5 py-1.5"
          style={{ gridTemplateColumns: `repeat(${MOBILE_NAV.length}, minmax(0, 1fr))` }}
        >
          {MOBILE_NAV.map((item) => (
            <BottomLink key={item.to} {...item} />
          ))}
        </div>
      </nav>

      {/* Mobile AI trigger */}
      <button
        onClick={() => setAiOpen(true)}
        className="md:hidden fixed bottom-24 end-4 z-40 grid place-items-center h-14 w-14 rounded-2xl bg-accent text-ink-950 shadow-[0_12px_30px_-8px_rgba(52,185,138,0.7)] focus-ring active:scale-95 transition-transform"
        aria-label="المساعد الذكي"
      >
        <Sparkle size={24} weight="fill" />
      </button>

      <AnimatePresence>{aiOpen && <AISidePanel onClose={() => setAiOpen(false)} />}</AnimatePresence>

      <InstallPrompt />
    </div>
  )
}

function SideLink({ to, label, icon: Icon, end }: (typeof NAV)[number]) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors focus-ring',
          isActive
            ? 'bg-accent-faint text-accent-strong font-medium'
            : 'text-ink-300 hover:bg-white/[0.05] hover:text-ink-100',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={20} weight={isActive ? 'fill' : 'regular'} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}

function BottomLink({ to, label, icon: Icon, end }: (typeof NAV)[number]) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'relative flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[10px] transition-colors',
          isActive ? 'text-accent-strong' : 'text-ink-400',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="bottomnav-active"
              className="absolute inset-x-2 -top-1.5 h-1 rounded-full bg-accent"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <Icon size={22} weight={isActive ? 'fill' : 'regular'} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}
