/// <reference types="vitest/config" />
import { configDefaults } from 'vitest/config'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { version } from './package.json' with { type: 'json' }

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    globals: false,
    environment: 'happy-dom',
    exclude: [...configDefaults.exclude, '**/.ignore/**'],
  },
})
