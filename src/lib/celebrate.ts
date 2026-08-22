import confetti from 'canvas-confetti'

const EMERALD = ['#34b98a', '#3fd39c', '#2a9d78', '#e6e6ea']

/** Celebration for completing a task or logging an achievement (side cannons). */
export function bigCelebrate() {
  const end = Date.now() + 900
  const frame = () => {
    confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors: EMERALD })
    confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors: EMERALD })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}
