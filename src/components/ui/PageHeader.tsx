export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink-100">{title}</h1>
        {subtitle && <p className="text-sm text-ink-400 mt-1.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
