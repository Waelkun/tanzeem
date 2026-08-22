import * as SwitchPrimitive from '@radix-ui/react-switch'

export function Switch({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="relative h-6 w-11 shrink-0 rounded-full bg-ink-700 transition-colors data-[state=checked]:bg-accent disabled:opacity-40 focus-ring"
    >
      <SwitchPrimitive.Thumb className="block h-5 w-5 rounded-full bg-white shadow transition-transform translate-x-0.5 data-[state=checked]:-translate-x-[1.375rem]" />
    </SwitchPrimitive.Root>
  )
}
