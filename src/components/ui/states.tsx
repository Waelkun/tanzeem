import type { Icon } from '@phosphor-icons/react'
import { WarningCircle } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} />
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="glass-soft rounded-2xl p-4 flex items-center gap-3">
          <div className="skeleton h-5 w-5 rounded-md shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({
  icon: IconCmp,
  title,
  hint,
  action,
}: {
  icon: Icon
  title: string
  hint?: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="grid place-items-center h-16 w-16 rounded-3xl bg-accent-faint text-accent mb-4">
        <IconCmp size={28} weight="duotone" />
      </div>
      <p className="text-ink-100 font-medium">{title}</p>
      {hint && <p className="text-sm text-ink-400 mt-1 max-w-xs">{hint}</p>}
      {action && (
        <Button variant="soft" size="sm" className="mt-5" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="grid place-items-center h-14 w-14 rounded-2xl bg-priority-high/15 text-priority-high mb-3">
        <WarningCircle size={26} weight="duotone" />
      </div>
      <p className="text-ink-200 text-sm">{message ?? 'حدث خطأ أثناء تحميل البيانات'}</p>
      {onRetry && (
        <Button variant="glass" size="sm" className="mt-4" onClick={onRetry}>
          إعادة المحاولة
        </Button>
      )}
    </div>
  )
}
