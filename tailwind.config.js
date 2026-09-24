/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Todos apuntan a las variables CSS de :root (src/index.css), que son la
      // ÚNICA fuente de verdad. No copiar valores aquí.
      colors: {
        // ── Sistema 2a ──
        marca: {
          DEFAULT: 'var(--marca)',
          sobre: 'var(--marca-sobre)',
          texto: 'var(--marca-texto)',
          suave: 'var(--marca-suave)',
        },
        acento: {
          DEFAULT: 'var(--acento)',
          sobre: 'var(--acento-sobre)',
          texto: 'var(--acento-texto)',
        },
        estado: {
          pagado: 'var(--estado-pagado)',
          'pagado-fondo': 'var(--estado-pagado-fondo)',
          'al-dia': 'var(--estado-al-dia)',
          'al-dia-fondo': 'var(--estado-al-dia-fondo)',
          'por-vencer': 'var(--estado-por-vencer)',
          'por-vencer-fondo': 'var(--estado-por-vencer-fondo)',
          mora: 'var(--estado-mora)',
          'mora-fondo': 'var(--estado-mora-fondo)',
          parcial: 'var(--estado-parcial)',
          'parcial-fondo': 'var(--estado-parcial-fondo)',
          pendiente: 'var(--estado-pendiente)',
          'pendiente-fondo': 'var(--estado-pendiente-fondo)',
        },
        tinta: {
          DEFAULT: 'var(--tinta)',
          2: 'var(--tinta-2)',
          3: 'var(--tinta-3)',
          'sobre-marca': 'var(--tinta-sobre-marca)',
        },
        fondo: 'var(--fondo)',
        superficie: {
          DEFAULT: 'var(--superficie)',
          2: 'var(--superficie-2)',
        },
        borde: {
          DEFAULT: 'var(--borde)',
          fila: 'var(--borde-fila)',
          control: 'var(--borde-control)',
        },

        // ── Nombres VIEJOS: apuntan a variables viejas que src/index.css mapea a
        // las nuevas. Siguen existiendo para las pantallas aún no rediseñadas;
        // no usarlos en código nuevo.
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
        sans: 'var(--font-ui)',
        ui: 'var(--font-ui)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        control: 'var(--radio-control)',
        tarjeta: 'var(--radio-tarjeta)',
        estado: 'var(--radio-estado)',
        // Viejos: sm → --r-sm · DEFAULT (`rounded`) → --r · lg → --r-lg.
        // DEFAULT en vez de una clave `r` para no chocar con `rounded-r`.
        sm: 'var(--r-sm)',
        DEFAULT: 'var(--r)',
        lg: 'var(--r-lg)',
      },
      boxShadow: {
        flotante: 'var(--sombra-flotante)',
        // Viejos
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
    },
  },
  plugins: [],
}
