# Schema deviations

Stalwart WebUI is schema-driven: the server's JSON schema is the single
source of truth for what forms, fields, filters, and columns exist. This
fork tries to stay aligned with that philosophy (see
[stalwartlabs/webui#discussion](https://github.com/stalwartlabs/webui) and
the maintainer's note on why exceptions belong server-side, not in the UI).

Everything in this file is a deliberate exception: a place where the UI
does something the schema doesn't (yet) describe, because the equivalent
server-side capability doesn't exist in [stalwartlabs/stalwart](https://github.com/stalwartlabs/stalwart)
or [stalwartlabs/webui](https://github.com/stalwartlabs/webui). Each entry
is tagged in code with `// SCHEMA-DEVIATION: <id>` so they're greppable
(`grep -rn "SCHEMA-DEVIATION" src/`).

The goal is **not** to remove these — they're real functionality this fork
wants to keep — but to track them separately from schema-driven code, so
it's always clear which is which, and so each one can be dropped the day
the server (or upstream webui) grows the equivalent native capability.

## `src/types/schema.ts` is never touched for a deviation

`src/types/schema.ts` mirrors the server's schema contract exactly and
must stay aligned with the official webui/server types — it is **never**
edited to accommodate a deviation, even to add an extra optional field.

If a deviation needs to carry extra data on an otherwise-official schema
shape (e.g. a flag consumed only by the deviation's own code), the
augmented type lives in the deviation's own module or in
[`src/lib/schemaDeviationTypes.ts`](src/lib/schemaDeviationTypes.ts), as
an intersection with the official type (`OfficialType & { extra?: ... }`),
and is imported only where the deviation is actually used. `schema.ts`
itself stays byte-for-byte alignable with upstream's version of the file.

## Status legend

- 🟡 **Workaround** — client-only, would be removed if the server supported it natively.
- 🔵 **Upstream tracked** — an issue has been filed upstream; link included.

## Deviations

### `log-client-filters` 🟡

- **Where**: [`src/lib/logFilters.ts`](src/lib/logFilters.ts), type augmentation in [`src/lib/schemaDeviationTypes.ts`](src/lib/schemaDeviationTypes.ts)
- **What**: injects `level` and `event` as filterable columns on the `x:Log` list, applied entirely client-side (`clientOnly` flag consumed by `DynamicList`). The `clientOnly` flag is declared as `ClientOnlyFilterEnum` (an intersection type), not on the official `FilterEnum` in `schema.ts`.
- **Why**: Stalwart's JMAP `x:Log/query` returns `unsupportedFilter` for both properties today, even though they're returned per row.
- **Ideal fix**: `stalwartlabs/stalwart` accepts `level`/`event` as real query filters; the schema then advertises them normally and `logFilters.ts` + the `ClientOnlyFilterEnum` augmentation are deleted.

### `account-quota-usage-column` 🟡

- **Where**: [`src/lib/accountColumns.ts`](src/lib/accountColumns.ts)
- **What**: adds a synthetic `quotaUsage` column to the `x:Account/User` and `x:Account/Group` lists — not a real schema property, `DynamicList` resolves it from the `usedDiskQuota` + `quotas.maxDiskQuota` pair and formats it specially. Also re-adds `roles` on the Users list only (a real property, just not in the list's default columns).
- **Why**: neither the Accounts nor the Groups list schema exposes usage/role as list columns, only as detail-view fields, even though both object types have real `usedDiskQuota`/`quotas` fields.
- **Ideal fix**: the server's `x:Account/User` and `x:Account/Group` list schemas include `roles` (Users) and a computed usage/quota column natively; this file is deleted.

### `mailbox-client-hierarchy-sort` 🟡

- **Where**: [`src/components/lists/DynamicList.tsx`](src/components/lists/DynamicList.tsx) — `sortMailboxesByHierarchy` and the `isMailboxList` branch
- **What**: for the `Mailbox` list, fetches the *entire* result set (bypassing normal server pagination) and sorts it client-side so each parent mailbox is immediately followed by its children, with indentation depth tracked in React state.
- **Why**: the server returns mailboxes in whatever order the query produces, not grouped by parent/child, and a mailbox's parent can land on a different page than the mailbox itself, so hierarchy can't be reconstructed one page at a time.
- **Ideal fix**: the server offers a native tree/hierarchical ordering (or a `sort` that groups by ancestry) for `Mailbox/query`; the client-side full-fetch-and-sort is deleted in favor of normal paginated queries.

### `webapp-enabled-column-fallback` 🟡

- **Where**: [`src/components/lists/DynamicList.tsx`](src/components/lists/DynamicList.tsx) — `displayColumns` in the `isWebApplications` branch
- **What**: reordering the `x:Application` list's real schema columns (Description first, Enabled second) is not a deviation, but if the schema's `list.columns` doesn't include an `enabled` column at all, a fallback column definition with a hardcoded label is fabricated client-side so the toggle still renders.
- **Why**: the `x:Application` list schema is not guaranteed to expose `enabled` as a list column, even though it's a real object property (fetched separately via `properties.push('enabled')`).
- **Ideal fix**: the server's `x:Application` list schema always includes `enabled` as a real column; the fallback branch is deleted (only the reordering logic remains, which is not a deviation).

### `account-alias-count-column` 🟡

- **Where**: [`src/lib/accountColumns.ts`](src/lib/accountColumns.ts), rendering in [`src/components/lists/DynamicList.tsx`](src/components/lists/DynamicList.tsx)
- **What**: adds a synthetic `aliasCount` column to the `x:Account/User` and `x:Account/Group` lists — not a real schema property; `DynamicList` resolves it from the real `aliases` objectList property and renders its entry count.
- **Why**: neither list's schema exposes alias count as a column, only the full `aliases` list on the detail view.
- **Ideal fix**: the server's `x:Account/User` and `x:Account/Group` list schemas include a computed alias-count column natively; this column definition is deleted.

## Not a deviation (for reference)

A few other `viewName === '...'` / `objectName === '...'` checks exist in
`DynamicList.tsx`, `MainContent.tsx`, `Sidebar.tsx`, `layout.ts`, and
`FieldWidget.tsx` (e.g. `x:OtpAuth`, `x:Expression`, `x:Rate`, `x:Action`,
`x:Trace`, `CustomComponent/Dashboard` and other `CustomComponent/*`
pages, the `x:Application` column reordering itself, the active-WebApp
info card). These are **not** tracked here: they render real schema data
with a custom widget or extra display, the same pattern already used
upstream for special object types — they don't fabricate data or bypass
the server's filtering/pagination. Verified against `upstream/main` for
each: the object/view names above already drive special-cased rendering
there too, except `x:Application`/`Mailbox`/`x:Log`/`x:Account/User`
which are fork-only and covered by the entries above (or explicitly
noted as presentation-only, e.g. the Web Applications column reorder).
