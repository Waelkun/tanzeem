/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'Tajawal', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // neutral base — charcoal, never pure black
        ink: {
          950: '#0a0a0b',
          900: '#111114',
          850: '#17171b',
          800: '#1d1d22',
          700: '#26262d',
          600: '#33333c',
          500: '#5c5c69',
          400: '#7a7a87',
          300: '#9494a1',
          200: '#c4c4cd',
          100: '#e6e6ea',
        },
        // single desaturated accent — emerald
        accent: {
          DEFAULT: '#34b98a',
          soft: '#2a9d78',
          strong: '#3fd39c',
          faint: 'rgba(52, 185, 138, 0.12)',
        },
        priority: {
          high: '#e0755f',
          med: '#d6a24a',
          low: '#5a9bd4',
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        glass: '0 20px 40px -20px rgba(0,0,0,0.55)',
        'glass-inset': 'inset 0 1px 0 rgba(255,255,255,0.08)',
        ring: '0 0 0 1px rgba(255,255,255,0.06)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.5', transform: 'scale(0.9)' },
          '50%': { opacity: '1', transform: 'scale(1.1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.8s linear infinite',
        breathe: 'breathe 2.4s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
