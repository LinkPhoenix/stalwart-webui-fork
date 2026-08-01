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

## 2. Get an access token

The WebUI normally authenticates through an OAuth flow in the browser, but
for local development it's simpler to skip that and use a bearer token
directly via `VITE_ACCESS_TOKEN` (see `.env.development`).

```bash
# Windows / PowerShell
pwsh ./scripts/dev-token.ps1

# Linux / macOS / any POSIX shell (including most AI agent sandboxes)
bash ./scripts/dev-token.sh
```

Both scripts log in as the dev container's admin account, run the full
OAuth PKCE flow against it, and write the resulting token to
`.env.development.local` (gitignored, never committed). Tokens expire
after 1 hour — re-run the script and restart `npm run dev` if the UI
starts returning 401s.

## 3. Run the WebUI

```bash
npm install   # first time only
npm run dev
```

Open `http://localhost:5173`. You should land directly in the admin panel
(no login screen) since `VITE_ACCESS_TOKEN` is set.

## 4. Verify your change

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
```

## Notes for AI agents

- This whole workflow (steps 1–3) is scriptable end-to-end without a
  browser: `npm run dev:server`, then `bash scripts/dev-token.sh`, then
  the app is reachable at `http://localhost:5173` with
  `VITE_ACCESS_TOKEN` already set. Verify backend connectivity directly
  with `curl`, e.g. `curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/jmap/session`.
- Read [AGENTS.md](AGENTS.md) before touching anything under `src/` —
  the schema-fidelity rule applies to all development, local test server
  or not.
- Don't commit `.env.development.local` (it holds a live token) or leave
  the dev container running unexpectedly — `npm run dev:server:down` when
  you're done.
