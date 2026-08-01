# Development

How to run a local Stalwart test server and develop this WebUI against it.
This file is meant to be read by humans and AI coding agents alike — see
[AGENTS.md](AGENTS.md) for the rules that also apply while doing this.

## Prerequisites

- Node.js 18+
- Docker (with the `docker compose` CLI plugin)

## 1. Start a local test server

```bash
npm run dev:server
```

This runs `docker compose up -d`, which starts a disposable Stalwart
instance ([`docker-compose.yml`](docker-compose.yml)) with:

- The management/JMAP HTTP API on `http://localhost:8080` (the only port
  the WebUI dev proxy needs — see `server.proxy` in
  [`vite.config.ts`](vite.config.ts)).
- Mail protocol ports (SMTP/IMAP/POP3/ManageSieve) exposed too, only
  needed if you're testing actual mail flows, not just admin UI screens.
- A fixed admin account baked in via `STALWART_RECOVERY_ADMIN`:
  `admin@example.org` / `c8321iEscHDy0GWV`. **Disposable dev credentials
  only — never reuse them for anything real.**
- Named Docker volumes (`stalwart-etc`, `stalwart-data`) so data survives
  a restart. Data persists until you tear the volumes down.

Useful companions:

```bash
npm run dev:server:logs   # tail the container's logs
npm run dev:server:down   # stop it (add `-v` via `docker compose down -v` to also wipe data)
```

The server takes a couple of seconds to come up; `docker compose logs stalwart`
will show `Network listener started ... localPort = 8080` once it's ready.

## 2. Initialize the server (first time only)

The container starts in Stalwart's bootstrap mode, which only allows
signing in as the break-glass `STALWART_RECOVERY_ADMIN` account — real
accounts and most settings aren't usable yet. Run once per fresh volume:

```bash
# Windows / PowerShell
pwsh ./scripts/dev-server-init.ps1

# Linux / macOS / any POSIX shell (including most AI agent sandboxes)
bash ./scripts/dev-server-init.sh
```

This completes the bootstrap wizard (default domain `example.org`, no TLS
certificate request — safe for local/offline use), creates a real
`devadmin@example.org` admin account, and sets the server's default OAuth
access token lifetime to 3 hours. It's idempotent — safe to re-run, it
no-ops once the server is already bootstrapped. You only need to re-run it
after `docker compose down -v` (which wipes the volumes).

## 3. Get an access token

For local development it's simpler to skip interactive login and use a
bearer token directly via `VITE_ACCESS_TOKEN` (see `.env.development`).

```bash
# Windows / PowerShell
pwsh ./scripts/dev-token.ps1              # 3 hour token (server default)
pwsh ./scripts/dev-token.ps1 -DurationSeconds 1800   # custom duration (30 min)

# Linux / macOS / any POSIX shell (including most AI agent sandboxes)
bash ./scripts/dev-token.sh               # 3 hour token
bash ./scripts/dev-token.sh 1800          # custom duration (30 min)
```

Both scripts authenticate as the `devadmin` account created in step 2 and
create a Stalwart API key with the requested expiry (default 3 hours,
overridable per invocation — this is a genuine per-request duration, not
a global setting), then write its secret to `.env.development.local`
(gitignored, never committed) as `VITE_ACCESS_TOKEN`. Re-run the script
and restart `npm run dev` once the token expires (the UI starts returning
401s).

The `STALWART_RECOVERY_ADMIN` account is intentionally not used here: it's
a break-glass credential and its tokens always expire in a fixed 1 hour
regardless of server configuration, so it can't honor a custom duration.

## 4. Run the WebUI

```bash
npm install   # first time only
npm run dev
```

Open `http://localhost:5173`. You should land directly in the admin panel
(no login screen) since `VITE_ACCESS_TOKEN` is set.

## 5. Verify your change

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

For UI changes, actually look at the running app (browser or a browser
automation tool) — passing typecheck/lint/tests proves the code compiles
and existing behavior didn't regress, it doesn't prove the new UI works.

## Resetting the test server

To start from a completely clean server (e.g. to re-test first-run
behavior):

```bash
npm run dev:server:down
docker compose down -v   # also removes the stalwart-etc/stalwart-data volumes
npm run dev:server
bash ./scripts/dev-server-init.sh   # re-run: fresh volume needs bootstrapping again
```

## Troubleshooting

- **UI shows a login screen instead of the admin panel, or the page fails
  to load data**: `npm run dev` only reads `.env.development.local` at
  startup. If you regenerate a token, or restart the Docker container,
  while `npm run dev` is already running, stop it (Ctrl+C) and start it
  again — it won't pick up the new token or reconnect on its own.
- **`Failed to fetch` / connection refused in the browser console**: the
  test server isn't running or isn't ready yet. Check with
  `docker ps --filter name=stalwart-webui-dev` and
  `npm run dev:server:logs`; wait for `Network listener started ...
  localPort = 8080` before retrying.
- **401s after everything was working**: your token expired. Re-run
  `scripts/dev-token.sh` (or `.ps1`) and restart `npm run dev`.
- **`scripts/dev-server-init.sh` fails with connection errors**: the
  container needs a few seconds after `npm run dev:server` before it
  accepts requests — the script retries for ~30s, but if your machine is
  slow, just re-run it.

## Notes for AI agents

- This whole workflow (steps 1–4) is scriptable end-to-end without a
  browser: `npm run dev:server`, then `bash scripts/dev-server-init.sh`
  (first time only), then `bash scripts/dev-token.sh`, then the app is
  reachable at `http://localhost:5173` with `VITE_ACCESS_TOKEN` already
  set. Verify backend connectivity directly with `curl`, e.g.
  `curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/jmap/session`.
- Read [AGENTS.md](AGENTS.md) before touching anything under `src/` —
  the schema-fidelity rule applies to all development, local test server
  or not.
- Don't commit `.env.development.local` (it holds a live token) or leave
  the dev container running unexpectedly — `npm run dev:server:down` when
  you're done.
