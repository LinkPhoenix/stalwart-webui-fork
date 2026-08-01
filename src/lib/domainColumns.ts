/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { Schema } from '@/types/schema';

/**
 * SCHEMA-DEVIATION: account-alias-count-column (see SCHEMA_DEVIATIONS.md)
 *
 * The Domains list doesn't expose alias-domain count as a column, only
 * the full `aliases` set on the detail view. Adds the same synthetic
 * `aliasCount` column already used on Accounts/Groups/Mailing Lists —
 * DynamicList's generic count-column handling picks it up with no
 * further wiring.
 */
export function withDomainColumns(schema: Schema): Schema {
  const list = schema.lists['x:Domain'];
  if (!list) return schema;

  return {
    ...schema,
    lists: {
      ...schema.lists,
      'x:Domain': { ...list, columns: [...list.columns, { name: 'aliasCount', label: 'Aliases' }] },
    },
  };
}
