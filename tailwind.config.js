/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Todos apuntan a las variables CSS de :root (src/index.css),
      // que siguen siendo la ÚNICA fuente de verdad. No hardcodear valores.
      colors: {
        green: 'var(--green)',
        'green-700': 'var(--green-700)',
        'green-600': 'var(--green-600)',
        'green-tint': 'var(--green-tint)',
        'green-tint-2': 'var(--green-tint-2)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-soft': 'var(--ink-soft)',
        bg: 'var(--bg)',
        card: 'var(--card)',
        line: 'var(--line)',
        'line-soft': 'var(--line-soft)',
        amber: 'var(--amber)',
        'amber-tint': 'var(--amber-tint)',
        red: 'var(--red)',
        'red-tint': 'var(--red-tint)',
        'red-tint-2': 'var(--red-tint-2)',
        text: 'var(--text)',
        'text-2': 'var(--text-2)',
        muted: 'var(--muted)',
      },
      fontFamily: {
        ui: 'var(--font-ui)',
        mono: 'var(--font-mono)',
      },
      // sm → --r-sm (9px) · DEFAULT (`rounded`) → --r (14px) · lg → --r-lg (18px).
      // Se usa DEFAULT en vez de una clave `r` para no chocar con la utilidad
      // nativa `rounded-r` (radio del lado derecho).
      borderRadius: {
        sm: 'var(--r-sm)',
        DEFAULT: 'var(--r)',
        lg: 'var(--r-lg)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
    },
  },
  plugins: [],
}
