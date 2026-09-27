import { defineConfig, type Plugin } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { version } from './package.json'
import { assertNoDevelopmentTokenInBuild } from './src/lib/devAccessToken'

/** Restart the dev server when the disposable token / proxy env file changes. */
function restartOnEnvDevelopmentLocal(): Plugin {
  const envFile = path.resolve(__dirname, '.env.development.local')
  return {
    name: 'restart-on-env-development-local',
    configureServer(server) {
      server.watcher.add(envFile)
      const maybeRestart = (changed: string) => {
        if (path.resolve(changed) === envFile) {
          void server.restart()
        }
      }
      server.watcher.on('change', maybeRestart)
      server.watcher.on('add', maybeRestart)
    },
  }
}

export default defineConfig(({ command, mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'VITE_')
  assertNoDevelopmentTokenInBuild(command, environment.VITE_ACCESS_TOKEN)

  return {
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
    plugins: [react(), tailwindcss(), restartOnEnvDevelopmentLocal()],
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
      //
      // OAuth: /api/discover returns relative authorization_endpoint `/login`
      // and token_endpoint `/auth/token`. Proxy those to Stalwart so interactive
      // login works without VITE_ACCESS_TOKEN. Bare `/login` (no authorize
      // query) stays the React SPA username gate.
      proxy: {
        '/api': { target: 'http://localhost:8080', changeOrigin: true, ws: true },
        '/jmap': { target: 'http://localhost:8080', changeOrigin: true, ws: true },
        '/auth': { target: 'http://localhost:8080', changeOrigin: true },
        '/logo': { target: 'http://localhost:8080', changeOrigin: true },
        '/login': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          bypass(req) {
            const url = req.url ?? ''
            if (!/[?&]response_type=/.test(url)) {
              return '/index.html'
            }
          },
        },
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
  }
})
