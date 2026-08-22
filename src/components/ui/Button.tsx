import { forwardRef } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'ghost' | 'glass' | 'danger' | 'soft'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: Variant
  size?: Size
}

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-ink-950 font-semibold hover:bg-accent-strong shadow-[0_8px_20px_-8px_rgba(52,185,138,0.6)]',
  soft: 'bg-accent-faint text-accent-strong hover:bg-accent/20 border border-accent/20',
  ghost: 'text-ink-200 hover:bg-white/[0.06] hover:text-ink-100',
  glass: 'glass-soft text-ink-100 hover:bg-white/[0.06]',
  danger: 'bg-priority-high/15 text-priority-high hover:bg-priority-high/25 border border-priority-high/20',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-sm gap-2 rounded-2xl',
  lg: 'h-13 px-6 text-base gap-2 rounded-2xl',
  icon: 'h-10 w-10 rounded-xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'ghost', size = 'md', children, disabled, ...props }, ref) => (
    <motion.button
      ref={ref}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center transition-colors focus-ring select-none',
        'disabled:opacity-40 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  ),
)
Button.displayName = 'Button'
