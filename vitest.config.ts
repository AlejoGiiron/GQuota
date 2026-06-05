import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Config propia de los tests: NO carga @vitejs/plugin-react (los tests del
// motor son lógica pura, sin JSX), así se evitan los warnings de esbuild/oxc
// que aparecían al heredar vite.config.ts.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
