# Schema fidelity

Stay schema-driven: the server's JSON schema is the single source of truth for what forms, fields, filters, and columns exist. This is why upstream (stalwartlabs/webui) rejects PRs that hardcode exceptions instead of fixing the schema/server — see [SCHEMA_DEVIATIONS.md](../../SCHEMA_DEVIATIONS.md) for the full rationale and the tracked list.

## When this applies

- Adding or changing anything in `DynamicList.tsx`, `FieldWidget.tsx`, `DynamicForm.tsx`, `layout.ts`, `schemaResolver.ts`, or any `src/lib/*Columns.ts` / `*Filters.ts` file.
- Adding a new list column, filter, form field, or navigation entry.
- Any change driven by a specific object/view name (`viewName === 'x:...'`, `objectName === 'x:...'`).

## Rules

- **NEVER** add a hardcoded `viewName === '...'` / `objectName === '...'` branch, a synthetic/computed column, or a client-side filter/sort workaround without checking first whether the schema already supports it.
- Widget-level special cases for object types the schema itself designates (e.g. `x:OtpAuth`, `x:Expression`, `x:Rate`) are fine — that pattern already exists upstream and just renders real schema data with a dedicated widget.
- **CRITICAL**: if something genuinely cannot be done through the schema because the server (`stalwartlabs/stalwart`) or upstream webui doesn't support it yet, it must become a tracked deviation, not a silent workaround:
  1. Add an entry to `SCHEMA_DEVIATIONS.md` (id, file location, what it does, why it's needed, the ideal server-side fix, status `🟡 Workaround` or `🔵 Upstream tracked`).
  2. Tag the code with `// SCHEMA-DEVIATION: <id>` pointing at that entry.
  3. Prefer filing (or pointing the user to file) an issue against `stalwartlabs/stalwart` or `stalwartlabs/webui` for the ideal fix.
- **CRITICAL**: `src/types/schema.ts` must **never** be edited for a deviation, not even to add an extra optional field — it must stay alignable with upstream's copy of the file. If a deviation needs to carry extra data on an official schema shape, declare the augmented type as an intersection (`OfficialType & { extra?: ... }`) in the deviation's own module, or in `src/lib/schemaDeviationTypes.ts`, and import it only where the deviation is used.
- Never remove a `SCHEMA-DEVIATION` tag or its `SCHEMA_DEVIATIONS.md` entry without confirming the underlying server/schema capability actually landed.
- Pure client-side/presentational logic (theming, dark mode, responsive layout, sidebar UX, appearance settings) is not a schema concern — no deviation tracking needed for those.

## Example

```ts
// SCHEMA-DEVIATION: log-client-filters (see SCHEMA_DEVIATIONS.md)
//
// The Stalwart JMAP backend rejects `level`/`event` as filter conditions on
// `x:Log/query` (`unsupportedFilter`) ... [why + ideal fix]
```
