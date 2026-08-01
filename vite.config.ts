import { defineConfig } from 'vitest/config'
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
    // Preview tooling assigns a free port via $PORT; fall back to Vite's
    // own default for plain `npm run dev`.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    // Same-origin proxy to the local Stalwart container: avoids CORS entirely
    // (VITE_API_BASE_URL stays empty in .env.development.local).
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true, ws: true },
      '/jmap': { target: 'http://localhost:8080', changeOrigin: true, ws: true },
    },
    watch: {
      // Release artifacts lock on Windows and crash the watcher (EBUSY).
      ignored: ['**/webui.zip', '**/release_body.md'],
    },
  },
  test: {
    globals: false,
    environment: 'happy-dom',
  },
})
