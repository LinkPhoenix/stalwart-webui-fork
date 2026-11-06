import type { Column, Schema } from '@/types/schema';

/**
 * SCHEMA-DEVIATION: webapp-enabled-column-fallback, sieve-script-active-column-fallback
 * (see SCHEMA_DEVIATIONS.md)
 *
 * Adds real-property columns the schema's lists omit: `enabled` on Web
 * Applications (shown second, after Description, like Domains) and
 * `isActive` on the System/User Sieve script lists (shown after the
 * identifier, like the per-account Sieve list).
 */
export function withDisplayColumnFallbacks(schema: Schema): Schema {
  let lists = schema.lists;

  const apps = lists['x:Application'];
  if (apps) {
    const description = apps.columns.find((c) => c.name === 'description');
    // Newer servers dropped the `enabled` property: only show the column when it still exists.
    const hasEnabled = !!schema.fields['x:Application']?.properties.enabled;
    const enabled =
      apps.columns.find((c) => c.name === 'enabled') ?? (hasEnabled ? { name: 'enabled', label: 'Enabled' } : null);
    const rest = apps.columns.filter((c) => c.name !== 'description' && c.name !== 'enabled');
    const columns: Column[] = [...(description ? [description] : []), ...(enabled ? [enabled] : []), ...rest];
    lists = { ...lists, 'x:Application': { ...apps, columns } };
  }

  for (const key of ['x:SieveSystemScript', 'x:SieveUserScript']) {
    const list = lists[key];
    if (!list || list.columns.some((c) => c.name === 'isActive')) continue;
    if (!schema.fields[key]?.properties.isActive) continue;
    const [first, ...rest] = list.columns;
    const active: Column = { name: 'isActive', label: 'Active' };
    lists = { ...lists, [key]: { ...list, columns: first ? [first, active, ...rest] : [active] } };
  }

  return lists === schema.lists ? schema : { ...schema, lists };
}
