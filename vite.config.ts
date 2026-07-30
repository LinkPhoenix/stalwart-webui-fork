import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { version } from './package.json'

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Stalwart WebUI',
        short_name: 'Stalwart',
        description: 'Administration panel for Stalwart Mail Server',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#db2d54',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // /api and /jmap serve authenticated mail data: never precache or
        // runtime-cache them, always hit the network so an installed PWA
        // can't show stale or cross-account data from a previous session.
        navigateFallbackDenylist: [/^\/api/, /^\/jmap/],
      },
    }),
  ],
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
