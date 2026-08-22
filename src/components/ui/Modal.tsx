import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function Modal({ open, onOpenChange, title, description, children, className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-ink-950/70 backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 8 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                className={cn(
                  // Mobile: bottom sheet. Desktop: centered via inset-0 + m-auto
                  // (NOT translate — Framer Motion owns `transform` for the open
                  // animation, so transform-based centering would be overridden
                  // and push the dialog off-screen).
                  'fixed z-50 w-full max-w-lg glass p-6 max-h-[90dvh] overflow-y-auto',
                  'inset-x-0 bottom-0 mx-auto rounded-t-4xl',
                  'sm:inset-0 sm:m-auto sm:h-fit sm:rounded-4xl',
                  className,
                )}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="min-w-0">
                    {title && (
                      <Dialog.Title className="text-lg font-semibold text-ink-100 tracking-tight">
                        {title}
                      </Dialog.Title>
                    )}
                    {description && (
                      <Dialog.Description className="text-sm text-ink-400 mt-1">
                        {description}
                      </Dialog.Description>
                    )}
                  </div>
                  <Dialog.Close className="shrink-0 rounded-xl p-2 text-ink-400 hover:bg-white/[0.06] hover:text-ink-100 transition-colors focus-ring">
                    <X size={18} />
                  </Dialog.Close>
                </div>
                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
