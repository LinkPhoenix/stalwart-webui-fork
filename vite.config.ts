/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { version } from './package.json'

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Same-origin proxy to the local Stalwart container: avoids CORS entirely
    // (VITE_API_BASE_URL stays empty in .env.development.local).
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true, ws: true },
      '/jmap': { target: 'http://localhost:8080', changeOrigin: true, ws: true },
    },
  },
  test: {
    globals: false,
    environment: 'happy-dom',
  },
})
