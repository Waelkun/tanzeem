import { useMemo, useState } from 'react'
import { Check, Plus, X } from '@phosphor-icons/react'
import { useTasks } from '@/lib/queries'
import { DEFAULT_CATEGORIES } from '@/lib/types'
import { cn } from '@/lib/cn'

interface Props {
  value: string
  onChange: (value: string) => void
}

/**
 * Category selector: pick from built-in categories plus any the user has already
 * used on other tasks, or create a new one on the fly. Stores a plain string in
 * `tasks.category` (empty string = no category).
 */
export function CategoryPicker({ value, onChange }: Props) {
  const { data: tasks } = useTasks()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  // Merge built-ins with categories already used across tasks (deduped), and make
  // sure the current value is always present as a selectable chip.
  const categories = useMemo(() => {
    const used = (tasks ?? [])
      .map((t) => t.category?.trim())
      .filter((c): c is string => !!c)
    const set = new Set<string>([...DEFAULT_CATEGORIES, ...used])
    if (value.trim()) set.add(value.trim())
    return Array.from(set)
  }, [tasks, value])

  const commitNew = () => {
    const c = draft.trim()
    if (c) onChange(c)
    setDraft('')
    setAdding(false)
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((c) => {
        const active = c === value
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(active ? '' : c)}
            className={cn(
              'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition-colors focus-ring',
              active
                ? 'bg-accent-faint text-accent-strong font-medium border border-accent/30'
                : 'bg-ink-850/70 text-ink-300 border border-white/[0.06] hover:text-ink-100',
            )}
          >
            {active && <Check size={13} weight="bold" />}
            {c}
          </button>
        )
      })}

      {adding ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-ink-850/70 border border-accent/30 ps-3 pe-1 py-0.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitNew()
              }
              if (e.key === 'Escape') {
                setDraft('')
                setAdding(false)
              }
            }}
            autoFocus
            placeholder="فئة جديدة…"
            className="w-24 bg-transparent text-sm text-ink-100 placeholder:text-ink-500 outline-none"
          />
          <button
            type="button"
            onClick={commitNew}
            className="grid place-items-center h-6 w-6 rounded-full text-accent-strong hover:bg-white/[0.08]"
            aria-label="إضافة الفئة"
          >
            <Check size={14} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft('')
              setAdding(false)
            }}
            className="grid place-items-center h-6 w-6 rounded-full text-ink-400 hover:bg-white/[0.08]"
            aria-label="إلغاء"
          >
            <X size={14} />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm text-ink-400 border border-dashed border-white/15 hover:text-ink-100 hover:border-white/25 transition-colors focus-ring"
        >
          <Plus size={13} weight="bold" />
          فئة جديدة
        </button>
      )}
    </div>
  )
}
