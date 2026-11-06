# Upstream report: `stalwartlabs/webui` 1.0.11 → 2.0.5

Analysis date: 2026-11-06. Read-only study (`git fetch upstream` + `git merge-tree`
dry run); nothing has been merged. Companion to the generic playbook in
[UPSTREAM_SYNC.md](UPSTREAM_SYNC.md).

## 1. Snapshot

| Item | Value |
|------|-------|
| Last common ancestor | `dc462b1` (upstream package version 1.0.11) |
| Upstream commits not in the fork | 12 (`1b0ce53` → `44b3f91`), tags `v2.0.0` … `v2.0.5` |
| Fork commits not in upstream | 182 (fork releases up to 1.3.2) |
| Upstream diff | 219 files, +17 200 / −14 553 (112 added, 91 modified, 15 deleted, 1 renamed) |
| Dry-run merge | **45 conflicting files** (see §4) |
| Fork `src/types/schema.ts` | Upstream changed it (see §3.1); fork must take upstream's version byte for byte |

This is a **major** version jump: the upstream UI was re-architected, not just
patched. A plain `git merge upstream/main` is feasible but every fork list/form
deviation lives in files that upstream split apart, so conflicts are structural.

## 2. What upstream shipped

### Release notes (from upstream `CHANGELOG.md`)

| Version | Date | Highlights |
|---------|------|-----------|
| 2.0.0 | 2026-10-26 | CIMD (OAuth Client ID Metadata Document) support; `public/oauth-client.json`; dashboard fixes |
| 2.0.1 | 2026-10-27 | Actions page hidden on Stalwart 1.0: create-only objects (`x:Action`) now shown to accounts with Create permission (#27) |
| 2.0.2 | 2026-10-28 | Object pickers scoped to the record's tenant (`memberTenantId`) |
| 2.0.3 | 2026-10-29 | OAuth: RFC 8707 `resource` parameter in authorize / code exchange / refresh; logout no longer revokes tokens |
| 2.0.4 | 2026-11-02 | **New design**: new palette, sidebar navigation, two-column generated forms, collapsible list items, segmented variant pickers, section index, floating save bar; schema-defined dashboards (stat / chart / headline / ranking tiles); `oauth-scopes` meta tag |
| 2.0.5 | 2026-11-05 | Passkey registration (Account > Credentials); dates/numbers formatted with the account or browser locale; bootstrap last-screen fix for external directories |

### Unlisted architectural changes (found in the diff)

1. **TanStack Query data layer** (`src/data/`: `objects`, `mutations`, `keys`,
   `queryClient`, `session`, `displayNames`, `objectOptions`). The Zustand
   `cacheStore` is deleted. Lists are fetched through `useJmapList`.
2. **`DynamicList.tsx` (≈2 700 lines in the fork) split** into `useDynamicList`,
   `listQuery`, `listUrlState`, `ListTable`, `ListCell`, `FilterBar`,
   `FilterFields`, `MassActionBar`, `RowActions`, `Pagination`,
   `SelectionBanner`, `useListActions`, `useListSelection`, …
   List state (filters, sort, **anchor-based pagination**) now lives in the URL.
3. **`FieldWidget.tsx` (2 334 lines) deleted**, replaced by
   `forms/widgets/*` (registry-based) + `formReducer`, `formLogic`,
   `useDynamicForm`, `FormProvider`, `FormSections`, `VariantSelect`.
4. **Read-only rendering moved to `components/values/FieldValue.tsx`**
   (used by lists and `DynamicView`).
5. **Layout**: `Sidebar`/`TopBar` rewritten; new `navTree.ts`,
   `useLayoutNavigation.ts`, `sidebarContext.ts`; `lib/layout.ts` rewritten
   (custom-component permission rules: `LiveDelivery`, `Dashboard`, `LiveTracing`).
6. **Dashboards / tracing / troubleshoot refactored**; new SSE service
   (`services/sse.ts`, `hooks/useEventStream.ts`), `liveMetrics`, `queries`.
7. **Formatting**: new `lib/format.ts` (`formatNumber`, `formatDate`,
   `formatSize`, …, locale-aware via `accountStore`).
8. **Auth**: OAuth rewrite (`selectScopes`, `selectResource`, CIMD client id
   resolution, `lib/oauthClientId.ts`), `lib/adminRoute.ts`, `services/errors.ts`.
9. **Tooling**: React Compiler (`babel-plugin-react-compiler`,
   `@rolldown/plugin-babel`), `@tanstack/react-query`, `@noble/hashes`,
   self-hosted Inter / JetBrains Mono / Plus Jakarta Sans fonts, React 19.3,
   `package.json` `stalwart.minServerVersion = "1.0.0"`, and a build step that
   emits `stalwart-app.json` (id, version, min server version).
10. **Tests removed upstream**: vitest, `happy-dom`, all `*.test.ts` and the
    `test` scripts are gone ("tests are maintained in a separate repository").
    The fork has 26 test files and `npm run test`.
11. Schema additions: `BlobFormat = 'sieve'`, `StringFormat 'sieve'`,
    `FieldTypeBlobId.format`, `MetricScope`.
12. Licence markers: upstream added `SPDX-SnippetBegin … LicenseRef-SEL`
    blocks (Stalwart Enterprise License) around dashboard / live-tracing code.
    Keep those markers intact when resolving conflicts.

## 3. Impact on this fork

### 3.1 `src/types/schema.ts`

Take upstream's file unchanged (diff adds `BlobFormat`, `'sieve'` formats,
`MetricScope`, SPDX snippets). Verify afterwards with
`git diff upstream/main -- src/types/schema.ts` → empty.

### 3.2 Schema deviations: none are covered natively upstream

Searched upstream `main` for equivalents of every fork workaround (client
sort, problems-only, mailbox hierarchy, count columns, quota action, log
filters, onboarding/overview nav). **No match** — all 18 deviations remain
necessary. They must be **re-implemented against the new list architecture**.

| Deviation id | Old hook point (fork) | New hook point (upstream 2.0.5) |
|--------------|----------------------|---------------------------------|
| `log-client-filters` | `DynamicList` `clientOnly` filter handling | `listQuery.buildListFilter` / `useDynamicList` (filter now URL-driven, query via `useJmapList`); client-side filtering needs a post-fetch step |
| `onboarding-checklist-nav-entry`, `community-overview-nav-entry` | `schemaStore.withOnboardingNavEntry` / `withOverviewNavEntry` | Same store (`setSchema` still exists) but navigation now flows through `navTree.ts` / `Sidebar.tsx`; re-check the splice renders and `MainContent` routes |
| `account-quota-usage-column`, `account-alias-count-column`, `role-permission-count-columns`, `listener-tls-enabled-column`, `dns-provider-description-column`, `directory-description-column`, `webhook-configuration-columns`, `report-summary-columns` | Column injection (`lib/*Columns.ts`, applied in `AdminPanel.tsx`; `COUNT_COLUMN_SOURCES` + `renderCellValue` in `DynamicList`) | Injection point can stay (schema mutation at init). **Rendering** must move into `ListCell` / `FieldValue`; `buildListPageParams` derives `properties` from `list.columns`, so injected columns are fetched automatically |
| `account-client-sort`, `mailbox-client-hierarchy-sort`, `report-problems-only-filter` | `fetchData` branches in `DynamicList` (fetch-all then sort/filter) | `useDynamicList` is one `useJmapList` query with anchor pagination; a fetch-all path must be added as a separate query mode (respect `fetchAllGuardrails.ts`) |
| `webapp-enabled-column-fallback`, `sieve-script-active-column-fallback` | `displayColumns` / property injection in `DynamicList` | Move to a schema-level column patch (same pattern as `operationsListColumns`) instead of view-name branches in the component |
| `byte-size-number-format` | `byteSizeFormat.ts` in `renderCellValue` and `DynamicView` | **Possibly obsolete**: upstream `FieldValue`/`ScalarValues` already format `format: 'size'` with `lib/format.ts`. Re-test, then delete the deviation if the fork's numeric byte columns render correctly |
| `bulk-quota-change-action` | `DynamicList` mass-action menu + `ChangeQuotaDialog` / `PromptSetPropertyDialog` | New `MassActionBar.tsx` / `useListActions.ts` |

### 3.3 Fork-owned features to protect

Overview, Getting Started, Appearance (themes, corners, list density),
in-app Changelog, `lib/devAccessToken.ts`, Vite OAuth proxy and env watcher,
logo cache / backend icons, command-palette keywords, `lastVisited`, CSV export,
column preferences, queue-ops links.

* **Appearance vs new design**: upstream 2.0.4 replaced the palette and
  `index.css` (394 lines changed) and self-hosts fonts. Fork themes are CSS
  variables on the old tokens → expect to remap theme tokens to the new ones.
* **Overview vs upstream Dashboard**: upstream `MainContent` now falls back to
  `schema.dashboards[0] ?? 'overview'`. Dashboards are now schema-defined and
  richer (stat/chart/ranking tiles). Decide whether Overview stays as the
  Community-edition landing page (recommended: yes; Dashboard stays locked).
* **PWA**: still must not return (rule in `UPSTREAM_SYNC.md`); upstream does not add one.
* **Fork PR #1 "previous button" fix**: upstream reworked pagination with URL
  anchors and stranded-page recovery (`isStrandedPage`). The fork's fix is
  likely superseded; drop it during the `DynamicList` resolution.

### 3.4 Server compatibility

* Upstream 2.x declares `minServerVersion: 1.0.0` and emits `stalwart-app.json`.
* The dev stack uses `stalwartlabs/stalwart:latest` (unpinned). Pin or confirm
  the image is ≥ 1.0.0 before smoke tests; passkey registration and CIMD need
  a recent server.
* OAuth: new `resource` parameter + CIMD client id (`public/oauth-client.json`,
  `resolveOAuthClientId`). The fork's Vite OAuth proxy (`/auth`, `/login`) must be
  re-tested against the new flow; `vite.config.ts` conflicts here.

### 3.5 Tests and CI

* Upstream removed vitest and every test; the fork keeps 26 test files and
  `npm run test`. Resolve modify/delete conflicts **by keeping the fork's tests**
  (`durationFormat`, `authStore`, `cacheStore`, `jmapPatch`, `listFilter`,
  `oauthClientId`, `schemaResolver`, `sievepad`, `accountStore`, `oauth`), then
  fix those that target changed APIs (`cacheStore.ts` is deleted upstream; its test
  must be dropped or rewritten for TanStack Query). Keep `vitest`, `happy-dom`
  and `test` scripts in `package.json`.
* `.github/workflows/build.yml` conflicts: keep fork release/changelog logic
  (see `.agents/rules/releases.md`) and adopt upstream build changes by hand.

## 4. Conflict inventory (45 files)

Config / meta: `.github/workflows/build.yml`, `CHANGELOG.md`, `package.json`,
`package-lock.json`, `vite.config.ts`, `src/i18n/en.json`, `src/index.css`,
`src/main.tsx`.

Modify/delete (fork modified, upstream deleted): `forms/FieldWidget.tsx`,
`stores/cacheStore.ts`, `lib/durationFormat.test.ts`, `stores/cacheStore.test.ts`,
`stores/authStore.test.ts`.

Layout & chrome: `layout/{MainContent,ProtectedRoute,Sidebar,TopBar}.tsx`,
`common/{CommandPalette,LoadingFallback}.tsx`, `bootstrap/BootstrapWizard.tsx`,
`ui/{command,dialog,dropdown-menu,input,scroll-area,select,switch,textarea}.tsx`.

Lists / forms / views: `lists/DynamicList.tsx`, `forms/DynamicForm.tsx`,
`views/{DynamicView,DynamicViewPage}.tsx`.

Features: `dashboard/components/{DashboardChart,DashboardView,StatCard}.tsx`,
`tracing/components/TraceDetailView.tsx`.

Lib / hooks / stores / pages: `hooks/useGlobalSearch.ts`, `lib/{durationFormat,
lastVisited,layout}.ts`, `stores/{authStore,schemaStore}.ts`,
`pages/{AdminPanel,LoginPage,OAuthCallback}.tsx`.

## 5. Recommended strategy

Do **not** hand-resolve 45 files in one pass on `main`. Proposed phases, each
a reviewable commit on a dedicated branch (`sync/upstream-2.0.5`, cut from
`main`, not from `codex/v1301-list-fixes`):

1. **Merge with upstream taking the upstream side** for everything generic
   (UI primitives, forms, dashboards, tracing, auth, i18n base). Restore
   fork-only files untouched by upstream (Overview, Onboarding, Appearance,
   Changelog, `lib/*Columns.ts`, …). Keep fork tests and `package.json` test setup.
   Gate: `npm run typecheck` green (errors will list every broken fork hook).
2. **Re-skin**: remap Appearance themes / density onto the new `index.css`
   tokens; re-add fork nav entries through `navTree`/`Sidebar`; keep Overview landing.
3. **Re-attach list deviations** one by one on the new architecture
   (order: column injection → count columns → report summaries →
   mailbox/account client sort → problems-only → log client filters →
   bulk quota). Update `SCHEMA_DEVIATIONS.md` "Where" paths as each lands;
   drop `byte-size-number-format` if upstream formatting covers it.
4. **Auth / dev tooling**: re-test OAuth proxy, `devAccessToken`, `.env.development.local`
   restart; pin the Stalwart dev image ≥ 1.0.0.
5. **Tests & docs**: repair surviving tests, add tests for each re-attached
   deviation, run the manual smoke list from `UPSTREAM_SYNC.md`, add an
   Unreleased CHANGELOG entry, then cut the release per `.agents/rules/releases.md`
   (suggested: fork **2.0.0**-line, since the base is upstream 2.0.5 — to confirm).

## 6. Open decisions

* Fork version numbering after the sync (keep 1.x → 1.4.0, or align with 2.x).
* Keep fork vitest suite (recommended) vs follow upstream's "no tests in repo".
* Keep Overview as Community landing alongside upstream's schema dashboards.
* Fate of fork PR #1 pagination fix (expected: superseded).

## 7. Verification performed for this report

* `git fetch upstream` / `origin`; `git log`, `git diff --stat main...upstream/main`.
* `git merge-tree --write-tree --name-only main upstream/main` (no working-tree
  change; 45 conflicts).
* Read upstream `useDynamicList`, `listQuery`, `ListCell`, `ListTable`, `lib/format`,
  `lib/layout`, `lib/embeddedSchema`, `oauth.ts`, `vite.config.ts`, `package.json`,
  `src/types/schema.ts` diff and `CHANGELOG.md`.
* Not done: building/running upstream 2.0.5, running the fork's test suite against it.
