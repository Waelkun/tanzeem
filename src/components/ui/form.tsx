import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink-200">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-ink-500">{hint}</span>}
      {error && <span className="text-xs text-priority-high">{error}</span>}
    </label>
  )
}

const base =
  'w-full rounded-xl bg-ink-850/70 border border-white/[0.08] px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 transition-colors focus:border-accent/50 focus-ring'

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(base, className)} {...props} />,
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(base, 'min-h-24 resize-y leading-relaxed', className)} {...props} />
  ),
)
Textarea.displayName = 'Textarea'

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(base, 'appearance-none cursor-pointer bg-ink-850', className)} {...props}>
      {children}
    </select>
  ),
)
Select.displayName = 'Select'

interface SegmentOption<T extends string> {
  value: T
  label: string
  color?: string
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: SegmentOption<T>[]
}) {
  return (
    <div className="grid grid-flow-col auto-cols-fr gap-1 p-1 rounded-xl bg-ink-850/70 border border-white/[0.06]">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'relative py-2 text-sm rounded-lg transition-colors focus-ring',
              active ? 'text-ink-950 font-medium' : 'text-ink-300 hover:text-ink-100',
            )}
          >
            {active && (
              <span
                className="absolute inset-0 rounded-lg -z-0"
                style={{ background: o.color ?? '#34b98a' }}
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
