/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    port: 5173,

    // Proxying keeps the browser on a single origin in development. That removes CORS from the
    // loop entirely and, more importantly, lets the SameSite=Strict refresh cookie behave exactly
    // as it will in production rather than needing a dev-only relaxation.
    proxy: {
      '/api': {
        target: 'http://localhost:5166',
        changeOrigin: false,
      },
    },
  },

  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost' } },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/api/**', 'src/domain/**'],
    },
  },
})
