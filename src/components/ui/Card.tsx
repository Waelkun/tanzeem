import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

export const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('glass rounded-3xl', className)} {...props} />
  ),
)
Card.displayName = 'Card'

export const SoftCard = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('glass-soft rounded-2xl', className)} {...props} />
  ),
)
SoftCard.displayName = 'SoftCard'
