# Stalwart WebUI Fork

Community fork of [stalwartlabs/webui](https://github.com/stalwartlabs/webui), a schema-driven admin panel for [Stalwart](https://stalw.art). The server's JSON schema (fetched from `/api/schema`) is the single source of truth for forms, fields, filters, columns, and navigation.

## Tech Stack

- React 19 + Vite + TypeScript, Zustand stores, JMAP (RFC 8620) for all data operations.

## Commands

- `npm run dev:server` - Start a local disposable Stalwart test server (Docker); `npm run dev:server:down` to stop it
- `bash scripts/dev-server-init.sh` (or `pwsh ./scripts/dev-server-init.ps1`) - One-time setup of that server (bootstrap, dev admin account, 3h default token lifetime); idempotent
- `bash scripts/dev-token.sh [duration_seconds]` (or `pwsh ./scripts/dev-token.ps1 [-DurationSeconds N]`) - Get a dev access token from that server, 3h by default
- `npm run dev` - Dev server (proxies `/api` and `/jmap` to the test server)
- `npm run typecheck` - `tsc --noEmit`
- `npm run lint` - ESLint
- `npm run test` - Vitest (`npm run test:watch` to watch)
- `npm run build` - `tsc -b && vite build`

Full local dev workflow, including how to run it end-to-end without a browser: [DEVELOPMENT.md](DEVELOPMENT.md).

## Rules

The detailed rules live in `.agents/rules/`. Read the relevant file before acting:

- **Schema fidelity** - [.agents/rules/schema-fidelity.md](.agents/rules/schema-fidelity.md) - Stay schema-driven; how to handle cases the schema can't cover yet

## Universal Rules

- This applies to every AI coding agent working in this repo (Claude Code, Codex, Kimi, or any other) — not just one tool.
- Never hardcode object types, field names, filters, or columns as a shortcut. Read `.agents/rules/schema-fidelity.md` before adding anything that touches lists, forms, or navigation.
- **CRITICAL**: `src/types/schema.ts` mirrors the official server/webui schema contract and must never be edited to accommodate a deviation, not even to add an optional field. Deviation-only type augmentations go in `src/lib/schemaDeviationTypes.ts` (or the deviation's own module) as an intersection with the official type — see `.agents/rules/schema-fidelity.md`.
- Any client-side workaround for something the official schema doesn't support yet must be documented in `SCHEMA_DEVIATIONS.md` and tagged `// SCHEMA-DEVIATION: <id>` in code. Never add one silently.
