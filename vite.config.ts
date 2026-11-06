import { defineConfig, type Plugin } from 'vitest/config';
import { loadEnv } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from './package.json' with { type: 'json' };
import { assertNoDevelopmentTokenInBuild } from './src/lib/devAccessToken.ts';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** Restart the dev server when the disposable token / proxy env file changes. */
function restartOnEnvDevelopmentLocal(): Plugin {
  const envFile = path.resolve(projectRoot, '.env.development.local');
  return {
    name: 'restart-on-env-development-local',
    configureServer(server) {
      server.watcher.add(envFile);
      const maybeRestart = (changed: string) => {
        if (path.resolve(changed) === envFile) {
          void server.restart();
        }
      };
      server.watcher.on('change', maybeRestart);
      server.watcher.on('add', maybeRestart);
    },
  };
}

/** Client id of the OAuth client that scripts/dev-server-init registers on the dev server. */
const DEV_OAUTH_CLIENT_ID = 'stalwart-webui-dev';
/** Extra scope so the dev token carries the account's full admin permissions. */
const DEV_OAUTH_SCOPES = 'urn:stalwart:oauth:scope:full';

/**
 * Dev only: the Stalwart container cannot fetch the CIMD document from the
 * host's Vite server (`localhost` resolves to the container itself), so use
 * the pre-registered client instead. Production builds keep CIMD.
 */
function devOAuthClientId(): Plugin {
  return {
    name: 'dev-oauth-client-id',
    apply: 'serve',
    transformIndexHtml(html) {
      return html
        .replace(/(<meta\s+name="oauth-client-id"\s+content=")[^"]*(")/, `$1${DEV_OAUTH_CLIENT_ID}$2`)
        .replace(/(<meta\s+name="oauth-scopes"\s+content=")[^"]*(")/, `$1${DEV_OAUTH_SCOPES}$2`);
    },
  };
}

/** Emits the app manifest the server reads to check the minimum server version. */
function emitAppManifest(): Plugin {
  return {
    name: 'emit-app-manifest',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'stalwart-app.json',
        source: JSON.stringify({
          id: 'webui',
          version: pkg.version,
          minServerVersion: pkg.stalwart.minServerVersion,
        }),
      });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const environment = loadEnv(mode, projectRoot, 'VITE_');
  assertNoDevelopmentTokenInBuild(command, environment.VITE_ACCESS_TOKEN);

  return {
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
      emitAppManifest(),
      devOAuthClientId(),
      restartOnEnvDevelopmentLocal(),
    ],
    build: {
      assetsInlineLimit: (file: string) => (file.endsWith('.woff2') ? false : undefined),
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'icons',
                test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
                includeDependenciesRecursively: false,
              },
            ],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(projectRoot, './src'),
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
        // Stalwart's server-rendered sign-in page loads its own hashed
        // /ui-<hash>.css and .js from the site root; without these the form
        // falls back to a native GET submit and the OAuth flow never completes.
        '^/ui-[A-Za-z0-9]+\\.(css|js)$': { target: 'http://localhost:8080', changeOrigin: true },
        '/login': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          bypass(req) {
            const url = req.url ?? '';
            if (!/[?&]response_type=/.test(url)) {
              return '/index.html';
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
  };
});
