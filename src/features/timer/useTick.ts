import { useEffect, useState } from 'react'

/** Re-render every `ms` while `active`, to display a live-updating timer. */
export function useTick(active: boolean, ms = 1000) {
  const [, setN] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setN((n) => n + 1), ms)
    return () => clearInterval(id)
  }, [active, ms])
}
