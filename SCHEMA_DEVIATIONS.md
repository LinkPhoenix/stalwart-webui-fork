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

### `onboarding-checklist-nav-entry` 🟡

- **Where**: [`src/stores/schemaStore.ts`](src/stores/schemaStore.ts) — `withOnboardingNavEntry` / `showOnboardingNav` / `hideOnboardingNav`; [`src/features/onboarding/checklist.ts`](src/features/onboarding/checklist.ts); [`src/features/onboarding/OnboardingChecklistPage.tsx`](src/features/onboarding/OnboardingChecklistPage.tsx); [`src/features/onboarding/OnboardingNavGate.tsx`](src/features/onboarding/OnboardingNavGate.tsx); routed in [`src/components/layout/MainContent.tsx`](src/components/layout/MainContent.tsx)
- **What**: fabricates a "Getting Started" link (`CustomComponent/Onboarding`) for the first layout — the server's `schema.layouts` doesn't (and has no way to) describe this page. The entry is **not** inserted in `setSchema`; `OnboardingNavGate` calls `showOnboardingNav` only after confirming required checklist steps are still pending, and `hideOnboardingNav` when they are done (redirecting away if the user is still on that page). That keeps completed installs from flashing the item then removing it. The page itself only reads real, already-editable data (domain `isEnabled`, DKIM signature presence, certificate `notValidAfter`, an account with the `Admin` role, inbound DMARC report presence). Optional steps (e.g. DMARC reports) do not block hiding the nav. Doc/deep links under “Want to go further?” point at Stalwart docs or schema-resolved spam/listener views.
- **Why**: this is a fork-only convenience page (a first-run checklist), not something `stalwartlabs/stalwart`'s schema is expected to ever model — unlike the other entries here, there's no server-side "ideal fix" that would make this unnecessary.
- **Ideal fix**: none expected; kept as a deviation only so it stays clearly flagged as fork-only UI rather than looking like it came from the schema. Remove `withOnboardingNavEntry` / `showOnboardingNav` and the `Onboarding` case in `MainContent.tsx` to drop it.

### `community-overview-nav-entry` 🟡

- **Where**: [`src/stores/schemaStore.ts`](src/stores/schemaStore.ts) — `withOverviewNavEntry` (applied in `setSchema`; Getting Started may be spliced above it later); [`src/features/overview/`](src/features/overview/); routed in [`src/components/layout/MainContent.tsx`](src/components/layout/MainContent.tsx)
- **What**: splices an "Overview" link (`CustomComponent/Overview`) into the first layout's items under Dashboard. When Getting Started is later shown as still useful, it is inserted immediately above Overview. The page shows permission-gated inventory totals via cheap JMAP `*/query` calls with `calculateTotal: true` (directory, mail readiness, access & apps, reports) — real object counts only, not Enterprise live metrics.
- **Why**: the Enterprise Dashboard needs `liveMetrics` / `x:Metric` and is locked or hidden on Community/OSS; Community admins still need a high-level inventory view. The server's schema has no way to describe this fork-only page.
- **Ideal fix**: none expected; remove `withOverviewNavEntry` and the `Overview` case in `MainContent.tsx` to drop it.

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

### `byte-size-number-format` 🟡

- **Where**: [`src/lib/byteSizeFormat.ts`](src/lib/byteSizeFormat.ts); applied in [`src/components/lists/DynamicList.tsx`](src/components/lists/DynamicList.tsx) (`renderCellValue`) and [`src/components/views/DynamicView.tsx`](src/components/views/DynamicView.tsx) (`ViewValue`)
- **What**: when a number property is named like a byte quantity (`size`, `maxSize`, `usedDiskQuota`, `maxDiskQuota`) but the schema still advertises `integer` / `unsignedInteger`, display it with the shared dynamic size formatter (B → KB → MB → GB → TB) instead of a bare locale number such as `1,254`.
- **Why**: most Stalwart byte fields correctly use `format: "size"`, but at least `x:QueuedMessage.size` is still `unsignedInteger` in the live schema, so queue/list Size columns showed unitless counts.
- **Ideal fix**: the server's field schemas mark every byte quantity as `format: "size"` (including queued-message `size`); `byteSizeFormat.ts` and its call sites are deleted.

### `bulk-quota-change-action` 🟡

- **Where**: [`src/components/lists/DynamicList.tsx`](src/components/lists/DynamicList.tsx) — `canBulkChangeQuota` and the "Change quota…" `DropdownMenuItem`; [`src/components/lists/PromptSetPropertyDialog.tsx`](src/components/lists/PromptSetPropertyDialog.tsx) (generic client prompt); [`src/components/lists/ChangeQuotaDialog.tsx`](src/components/lists/ChangeQuotaDialog.tsx) (thin quota wrapper)
- **What**: adds a "Change quota…" bulk action to the Accounts and Groups lists (wherever the `quotaUsage` column already appears) that prompts for a new value, then applies it as a `quotas/maxDiskQuota` patch to every selected (or all-filter-matching) row via the same batched `executeMassAction` mechanism as any other bulk action. The prompt UI is shared (`PromptSetPropertyDialog`, `format: 'size'` today) so further prompted bulk actions can reuse it without new one-off dialogs.
- **Why**: `list.massActions` in the schema only supports fixed-value actions (`properties` is a static object) — there's no way for the server to declare a mass action that needs a value prompted from the admin, so a bulk "set everyone's quota to X" action can't be expressed there today, even though `quotas/maxDiskQuota` itself is a perfectly real, mutable property.
- **Ideal fix**: the schema grows a mass-action variant that names a target property (and its type/format) to prompt for, e.g. `{"type": "promptSetProperty", "property": "quotas/maxDiskQuota", "format": "size"}`; once that exists, this fork dialog and the `canBulkChangeQuota` branch are deleted in favor of the schema-driven prompted-mass-action UI.

### `sieve-script-active-column-fallback` 🟡

- **Where**: [`src/components/lists/DynamicList.tsx`](src/components/lists/DynamicList.tsx) — `displayColumns` and the property-fetch injection in `fetchData`, both gated on `isSieveScriptList`
- **What**: adds an `isActive` column (label "Active") to the `x:SieveSystemScript` and `x:SieveUserScript` lists, inserted right after the identifier column — not a synthetic value, `isActive` is a real boolean property on both objects, just not declared in either list's `list.columns`.
- **Why**: the per-account `SieveScript` list's schema already declares `isActive` as a column, but the System/User Sieve script lists under Settings don't, even though the property exists on both objects — so today you have to open each script to see whether it's active.
- **Ideal fix**: the server's `x:SieveSystemScript`/`x:SieveUserScript` list schemas include `isActive` as a real column like `SieveScript` already does; the fallback branch is deleted.

### `listener-tls-enabled-column` 🟡

- **Where**: [`src/lib/operationsListColumns.ts`](src/lib/operationsListColumns.ts), applied to `x:NetworkListener` during schema initialization in [`src/pages/AdminPanel.tsx`](src/pages/AdminPanel.tsx)
- **What**: adds the real `useTls` property as a `TLS Enabled` column after Protocol. The existing `tlsImplicit` column identifies implicit TLS, but does not show listeners that enable TLS without implicit TLS.
- **Why**: admins need to distinguish listeners with no TLS from listeners that enable TLS without opening each listener.
- **Ideal fix**: the server's `x:NetworkListener` list schema includes `useTls`; the fork column overlay is removed.

### `dns-provider-description-column` 🟡

- **Where**: [`src/lib/operationsListColumns.ts`](src/lib/operationsListColumns.ts), applied to `x:DnsServer` during schema initialization in [`src/pages/AdminPanel.tsx`](src/pages/AdminPanel.tsx)
- **What**: adds the real `description` property after the provider type. The list already identifies `description` as its label property, but does not include it among the visible columns.
- **Why**: providers sharing the same provider type are otherwise difficult to tell apart without opening each configuration.
- **Ideal fix**: the server's `x:DnsServer` list schema includes `description`; the fork column overlay is removed.

### `directory-description-column` 🟡

- **Where**: [`src/lib/operationsListColumns.ts`](src/lib/operationsListColumns.ts), applied to `x:Directory` during schema initialization in [`src/pages/AdminPanel.tsx`](src/pages/AdminPanel.tsx)
- **What**: adds the real `description` property after directory type. The current list exposes only `@type`, even though all LDAP, SQL, and OIDC directory variants share a description field and the list declares it as its label property.
- **Why**: admins can distinguish and recognize configured directories without opening them individually.
- **Ideal fix**: the server's `x:Directory` list schema includes `description`; the fork column overlay is removed.

### `webhook-configuration-columns` 🟡

- **Where**: [`src/lib/operationsListColumns.ts`](src/lib/operationsListColumns.ts), applied to `x:WebHook` during schema initialization in [`src/pages/AdminPanel.tsx`](src/pages/AdminPanel.tsx)
- **What**: adds the real `enable`, `eventsPolicy`, and `events` properties to the Webhooks list.
- **Why**: the current list shows only the endpoint URL, so admins cannot see whether a webhook is enabled or which events it includes/excludes without opening each configuration.
- **Ideal fix**: the server's `x:WebHook` list schema includes these real properties; the fork column overlay is removed.

### `account-alias-count-column` 🟡

- **Where**: [`src/lib/accountColumns.ts`](src/lib/accountColumns.ts), [`src/lib/mailingListColumns.ts`](src/lib/mailingListColumns.ts), [`src/lib/domainColumns.ts`](src/lib/domainColumns.ts), resolved generically via `COUNT_COLUMN_SOURCES` in [`src/components/lists/DynamicList.tsx`](src/components/lists/DynamicList.tsx)
- **What**: adds a synthetic `aliasCount` column to the `x:Account/User`, `x:Account/Group`, `x:MailingList`, and `x:Domain` lists — not a real schema property; `DynamicList` resolves it from the real `aliases` property (an objectList on Accounts/Groups/Mailing Lists, a `set` of domain names on Domains — same id-keyed wire format either way) and renders its entry count.
- **Why**: none of these lists' schemas expose alias count as a column, only the full `aliases` list on the detail view.
- **Ideal fix**: the server's list schemas include a computed alias-count column natively; these column definitions are deleted.

### `account-client-sort` 🟡

- **Where**: table-level mechanism in [`src/components/lists/DynamicList.tsx`](src/components/lists/DynamicList.tsx) (`clientSortableColumns`, `getClientSortValue`, the `fetchData` branch triggered by `clientSortField`) reading a `clientSortable` flag set per-column via the shared `clientSortable()` helper in [`src/lib/schemaDeviationTypes.ts`](src/lib/schemaDeviationTypes.ts) (type: `ClientSortableColumn`), used by [`accountColumns.ts`](src/lib/accountColumns.ts), [`mailingListColumns.ts`](src/lib/mailingListColumns.ts), [`roleColumns.ts`](src/lib/roleColumns.ts), and [`domainColumns.ts`](src/lib/domainColumns.ts)
- **What**: any column tagged `clientSortable` in the schema gets fetch-all-then-sort-in-memory on click (bypassing server pagination, same mechanism as `mailbox-client-hierarchy-sort`), instead of sending a JMAP `sort` to the server. The mechanism itself is generic and not tied to any specific list. Currently tagged: Email Address/Full Name/Usage/Aliases on `x:Account/User` and `x:Account/Group`; Email Address/Description/Aliases on `x:MailingList`; Description/Enabled Permissions/Disabled Permissions on `x:Role`; Domain Name/Enabled/Aliases on `x:Domain`.
- **Why**: none of these lists' schemas declare any sortable property at all (`list.sort` is absent on all four) — confirmed against a live server by trying `sort` on every displayed real column: all return `unsupportedSort`, **except** `x:Domain/query` with `sort: [{"property":"name",...}]`, which the server actually accepts despite the schema not declaring it. Rather than add a second "trust an undeclared sort" pathway for that one case, Domain Name is routed through the same client-sort mechanism as everything else, for consistency; it's marginally less efficient (fetch-all instead of a paginated server sort) but domain lists are typically small.
- **Ideal fix**: the server's query methods accept `sort` on these properties and the schema declares them in each list's `list.sort`; each `with*Columns` helper stops tagging its columns `clientSortable` and they fall through to the normal server-paginated `sortableFields` path already used elsewhere. The generic mechanism itself only goes away once nothing tags any column `clientSortable` anymore.

### `role-permission-count-columns` 🟡

- **Where**: [`src/lib/roleColumns.ts`](src/lib/roleColumns.ts); resolved generically by the same `COUNT_COLUMN_SOURCES` table in [`src/components/lists/DynamicList.tsx`](src/components/lists/DynamicList.tsx) used by `account-alias-count-column`
- **What**: adds synthetic `enabledPermissionCount`/`disabledPermissionCount` columns to the `x:Role` list — not real schema properties; resolved from the real `enabledPermissions`/`disabledPermissions` set properties and rendered as entry counts.
- **Why**: the Roles list schema only exposes Description as a column; seeing how broad or restrictive a role is requires opening it and counting permissions by hand.
- **Ideal fix**: the server's `x:Role` list schema includes computed enabled/disabled permission count columns natively; this column definition is deleted.

### `report-problems-only-filter` 🟡

- **Where**: [`src/components/lists/DynamicList.tsx`](src/components/lists/DynamicList.tsx) — `problemsOnly` toggle; predicate in [`src/lib/reportSummaries.ts`](src/lib/reportSummaries.ts) (`reportHasProblems`)
- **What**: on DMARC/TLS/ARF lists (those that already carry report-summary columns), a "Problems only" switch fetches the full result set (same client-filter path as logs) and keeps rows with quarantine/reject, failed TLS sessions, or ARF incidents > 0. Synced via `?problemsOnly=1`.
- **Why**: nested `report` fields are not queryable as JMAP filters, so "show me reports that need attention" cannot be expressed server-side today.
- **Ideal fix**: the server accepts filters on nested disposition/session/incident counts; the client toggle is deleted.

### `report-summary-columns` 🟡

- **Where**: [`src/lib/reportColumns.ts`](src/lib/reportColumns.ts), [`src/lib/reportSummaries.ts`](src/lib/reportSummaries.ts), resolved in [`src/components/lists/DynamicList.tsx`](src/components/lists/DynamicList.tsx)
- **What**: adds synthetic summary columns to inbound/outbound DMARC and TLS report lists, and to ARF reports — Pass/Quarantine/Reject (DMARC, summing nested `report.records` by `evaluatedDisposition`, with Pass including `pass`+`none`), Successful/Failed Sessions (TLS, summing nested `report.policies`), Incidents + Feedback Type (ARF, from nested `report`). DynamicList fetches the real `report` property once and derives the cell values (and client-sort keys) from it.
- **Why**: those lists' schemas only show envelope metadata (From/Subject/Received or Domain/dates), so admins must open each report to spot failures — tracked upstream as [stalwartlabs/webui#13](https://github.com/stalwartlabs/webui/issues/13).
- **Ideal fix**: the server's list schemas expose computed summary columns (or denormalized count properties) natively; `reportColumns.ts` / `reportSummaries.ts` and the DynamicList branch are deleted.

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
