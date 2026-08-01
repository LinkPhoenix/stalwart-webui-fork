/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { Schema } from '@/types/schema';
import { clientSortable } from './schemaDeviationTypes';

/**
 * SCHEMA-DEVIATION: account-alias-count-column (see SCHEMA_DEVIATIONS.md)
 *
 * The Domains list doesn't expose alias-domain count as a column, only
 * the full `aliases` set on the detail view. Adds the same synthetic
 * `aliasCount` column already used on Accounts/Groups/Mailing Lists —
 * DynamicList's generic count-column handling picks it up with no
 * further wiring.
 *
 * SCHEMA-DEVIATION: account-client-sort (see SCHEMA_DEVIATIONS.md)
 *
 * Domain Name, Enabled, and `aliasCount` are tagged `clientSortable`.
 * `name` is actually accepted by the live server's `sort` (unlike every
 * other property tried on every other list — see SCHEMA_DEVIATIONS.md),
 * but the schema still doesn't declare it in `list.sort`, so it's routed
 * through the same client-sort mechanism as the rest for consistency
 * rather than adding a second, one-off "trust an undeclared sort"
 * pathway for a single column.
 */
export function withDomainColumns(schema: Schema): Schema {
  const list = schema.lists['x:Domain'];
  if (!list) return schema;

  const columns = [
    ...list.columns.map((c) => (c.name === 'name' || c.name === 'isEnabled' ? clientSortable(c) : c)),
    clientSortable({ name: 'aliasCount', label: 'Aliases' }),
  ];

  return {
    ...schema,
    lists: {
      ...schema.lists,
      'x:Domain': { ...list, columns },
    },
  };
}
