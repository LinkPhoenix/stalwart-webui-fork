# Stalwart WebUI Fork

Community fork of [stalwartlabs/webui](https://github.com/stalwartlabs/webui), a schema-driven admin panel for [Stalwart](https://stalw.art). The server's JSON schema (fetched from `/api/schema`) is the single source of truth for forms, fields, filters, columns, and navigation.

## Tech Stack

- React 19 + Vite + TypeScript, Zustand stores, JMAP (RFC 8620) for all data operations.

## Commands

- `npm run dev` - Dev server
- `npm run typecheck` - `tsc --noEmit`
- `npm run lint` - ESLint
- `npm run test` - Vitest (`npm run test:watch` to watch)
- `npm run build` - `tsc -b && vite build`

## Rules

The detailed rules live in `.agents/rules/`. Read the relevant file before acting:

- **Schema fidelity** - [.agents/rules/schema-fidelity.md](.agents/rules/schema-fidelity.md) - Stay schema-driven; how to handle cases the schema can't cover yet

## Universal Rules

- This applies to every AI coding agent working in this repo (Claude Code, Codex, Kimi, or any other) — not just one tool.
- Never hardcode object types, field names, filters, or columns as a shortcut. Read `.agents/rules/schema-fidelity.md` before adding anything that touches lists, forms, or navigation.
- **CRITICAL**: `src/types/schema.ts` mirrors the official server/webui schema contract and must never be edited to accommodate a deviation, not even to add an optional field. Deviation-only type augmentations go in `src/lib/schemaDeviationTypes.ts` (or the deviation's own module) as an intersection with the official type — see `.agents/rules/schema-fidelity.md`.
- Any client-side workaround for something the official schema doesn't support yet must be documented in `SCHEMA_DEVIATIONS.md` and tagged `// SCHEMA-DEVIATION: <id>` in code. Never add one silently.
