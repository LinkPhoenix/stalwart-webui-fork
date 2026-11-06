# Upstream sync playbook

How to pull changes from [stalwartlabs/webui](https://github.com/stalwartlabs/webui) into this fork without losing fork-only work or inventing silent schema deviations.

Remote name expected: `upstream` → `https://github.com/stalwartlabs/webui.git`  
Fork remote: `origin` → your GitHub fork.

> Current pending sync (upstream 2.0.5, major re-architecture): see
> [UPSTREAM_V2_REPORT.md](UPSTREAM_V2_REPORT.md) for the impact analysis and phased plan.

## When to sync

- After an upstream WebUI release, or when you need a specific upstream fix.
- Before cutting a fork release if upstream has moved and you want to stay mergeable.
- Prefer small, frequent syncs over large multi-month merges.

## Hard rules (do not break)

1. **`src/types/schema.ts` must stay alignable with upstream.** Never edit it for a fork feature. Deviation-only types go in `src/lib/schemaDeviationTypes.ts` (or the deviation’s own module). See [SCHEMA_DEVIATIONS.md](../SCHEMA_DEVIATIONS.md) and [.agents/rules/schema-fidelity.md](../.agents/rules/schema-fidelity.md).
2. **Every `viewName` / fabricated column / client filter workaround** must already have (or get) a `SCHEMA-DEVIATION` id + entry. After a sync, grepping must not reveal new silent hardcodes.
3. **Do not “fix” merge conflicts by deleting fork pages** (Overview, Getting Started, Appearance, Changelog) or by dropping `SCHEMA_DEVIATIONS.md` entries without confirming upstream now covers them.

## Recommended workflow

### 1. Update remotes and fetch

```bash
git fetch origin
git fetch upstream --no-tags     # the fork reuses upstream's version numbers: never import its tags
git checkout main
git pull --ff-only origin main   # or your release branch
```

The fork releases under the same version number as the official WebUI it contains (see `.agents/rules/releases.md`), so upstream's `vX.Y.Z` tags collide with the fork's. `--no-tags` keeps them out of this clone; delete a stray local `vX.Y.Z` tag that points at an upstream commit before tagging a fork release.

### 2. Choose merge vs rebase

| Approach | When |
|----------|------|
| `git merge upstream/main` | Default for shared `main`; preserves history; safer with co-authors. |
| `git rebase upstream/main` | Only on a private branch you have not shared; rewrite carefully. |

Example (merge):

```bash
git merge upstream/main
# resolve conflicts, then:
git commit   # if merge created one
```

### 3. Conflict hotspots (expect these)

| Area | Why it conflicts | What to keep |
|------|------------------|--------------|
| `src/types/schema.ts` | Upstream type updates | **Upstream’s file** (or a pure upstream-aligned merge). Re-apply fork types only via `schemaDeviationTypes.ts`. |
| `src/components/lists/DynamicList.tsx` | Large file; fork list UX | Re-apply fork branches carefully; keep `// SCHEMA-DEVIATION:` tags. |
| `src/stores/schemaStore.ts` | Onboarding/Overview nav splice | Keep `withOnboardingNavEntry` / `withOverviewNavEntry`. |
| `src/components/layout/MainContent.tsx` | CustomComponent routes | Keep Overview / Onboarding / LiveDelivery / LiveTracing cases. |
| `vite.config.ts` | Dev proxy / env restart | Keep fork proxy (`/auth`, OAuth `/login`, env watcher). |
| `package.json` / lockfiles | Dep bumps | Prefer upstream versions unless a fork dep is required; re-run install. |
| `eslint.config.js` / `.oxlintrc.json` / `tsconfig*.json` | Upstream lints with ESLint and typescript-eslint on TypeScript 6 | Keep the fork's Oxlint config and TypeScript 7 (see [Toolchain deviations](#toolchain-deviations)). Delete any `eslint.config.js` that comes back, and port new upstream lint rules into `.oxlintrc.json`. |
| `CHANGELOG.md` / `README.md` | Docs diverge | Keep fork history; add an Unreleased note if the sync itself matters. |

### 4. Post-merge checklist (required)

Run through this before opening a PR or cutting a release:

```bash
# 1) Deviation tags still documented
rg -n "SCHEMA-DEVIATION:" src/
# Every id above must appear as ### \`id\` in SCHEMA_DEVIATIONS.md

# 2) No edits to the official schema contract for fork needs
git diff upstream/main -- src/types/schema.ts
# Prefer empty or upstream-only changes

# 3) Quality gates
bun run typecheck
bun run lint
bun run test
bun run build
```

Manual smoke (local stack from [DEVELOPMENT.md](../DEVELOPMENT.md)):

- [ ] Login (token bypass and/or interactive `/login` via Vite proxy)
- [ ] Community home lands on **Overview** when Dashboard is locked
- [ ] **Getting Started** checklist loads (or is hidden when complete)
- [ ] One directory list (Accounts) — columns, sort, Create
- [ ] Log Entries — client filters still work
- [ ] One report list — summary columns / Problems only if still present
- [ ] Appearance + Changelog pages
- [ ] Command palette finds Overview / theme keywords

### 5. SCHEMA_DEVIATIONS hygiene after sync

For each entry in [SCHEMA_DEVIATIONS.md](../SCHEMA_DEVIATIONS.md):

1. Confirm the code tag `// SCHEMA-DEVIATION: <id>` still exists.
2. If upstream/server now supports the capability natively:
   - Remove the client workaround.
   - Delete or mark the deviation entry (do not leave stale workarounds).
3. If upstream touched the same file but not the capability:
   - Re-test the workaround; update the “Where” paths if files moved.
4. Fork-only pages (`onboarding-checklist-nav-entry`, `community-overview-nav-entry`) are **not** expected to come from upstream — keep them unless you intentionally drop the feature.

### 6. Document the sync

Add a short `CHANGELOG.md` Unreleased note when the sync is user-visible or risky, e.g.:

```markdown
### Changed
- Merged `stalwartlabs/webui` through <commit-or-tag>; revalidated schema deviations.
```

## Toolchain deviations

These choices differ from upstream on purpose. Keep them when `package.json` or the config files conflict.

- **Oxlint instead of ESLint.** typescript-eslint needs the TypeScript compiler API, which TypeScript 7 does not ship (a new API is expected in 7.1). Oxlint parses TypeScript itself. The config is `.oxlintrc.json`: the same rules the ESLint config enabled (recommended, typescript-eslint recommended, react-hooks with the React Compiler rules, react-refresh), 93 rules in total. Not ported: `no-undef` and `no-useless-assignment` (nursery), `react-hooks/config` and `react-hooks/gating` (compiler options are not configurable in Oxlint). Oxlint honors `.gitignore`, so tracked files that match an ignore pattern must be un-ignored there (`!scripts/validate-release-tag.mjs`) to stay linted.
- **TypeScript 7** (native compiler). `typecheck` and the `tsc -b` step of `build` run the 7.x `tsc`. Nothing in the repository imports the `typescript` package, and `i18next` and `react-i18next` accept `^7` as a peer.
- **`@babel/core` stays on 7.x.** Babel 8.1 compiles, but `babel-plugin-react-compiler` 1.0.0 then fails on every destructured parameter with a default value (`Expected object property value to be an LVal, got: AssignmentPattern`): 70 compile errors instead of 21, so about 30 components and hooks silently lose automatic memoization. Check it again whenever `babel-plugin-react-compiler` publishes a release: run the plugin with a `logger` over `src/` under both Babel versions and compare the `CompileSuccess` and `CompileError` counts.
- **Two lockfiles, both kept current.** `package-lock.json` is what CI installs (`npm ci`) and `bun.lock` serves bun, upstream's package manager. After any dependency change refresh both: `npm install`, then `bun install --lockfile-only`. Bun keeps existing transitive resolutions, so after a bulk update delete `bun.lock` before regenerating it, then check `bun outdated` and `bun audit`.

## What this fork owns (do not drop on sync)

- Community **Overview** inventory + attention signals
- **Getting Started** checklist nav + gate
- Appearance (themes, corners, **list density**), in-app Changelog
- Report summary columns / Problems only, log client filters, account/role/mailbox list helpers
- Dev: Vite OAuth proxy, `.env.development.local` restart, disposable Docker workflow
- Docs: this playbook, `SCHEMA_DEVIATIONS.md`, README screenshots

## What to refuse during a sync

- Partial-search client filters over entire directories “to match upstream UX”
- Fake Enterprise Dashboard metrics / mock `x:Metric`
- Editing `src/types/schema.ts` to make a merge “easier”
- Re-adding a PWA / service worker (removed; breaks mount-path installs)
- Silent new `viewName === '…'` branches without a deviation entry

## Quick reference commands

```bash
git fetch upstream
git log --oneline main..upstream/main | head
git merge upstream/main
rg -n "SCHEMA-DEVIATION:" src/
bun run typecheck && bun run lint && bun run test && bun run build
```
