import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public')
mkdirSync(outDir, { recursive: true })

// 512-based artwork. Glyph kept within the central ~60% for maskable safe zone.
const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="em" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3fd39c"/>
      <stop offset="1" stop-color="#2a9d78"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.38" r="0.6">
      <stop offset="0" stop-color="#34b98a" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#34b98a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="#0a0a0b"/>
  <rect width="512" height="512" fill="url(#glow)"/>
  <g transform="translate(256,256)">
    <circle r="118" fill="none" stroke="url(#em)" stroke-width="16" stroke-opacity="0.35"/>
    <path d="M -60 6 L -18 50 L 66 -50"
          fill="none" stroke="url(#em)" stroke-width="30"
          stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`

const targets = [
  { name: 'pwa-192.png', size: 192 },
  { name: 'pwa-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const t of targets) {
  await sharp(Buffer.from(svg)).resize(t.size, t.size).png().toFile(join(outDir, t.name))
  console.log('wrote', t.name)
}
