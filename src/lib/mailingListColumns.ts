/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { Schema } from '@/types/schema';

/**
 * SCHEMA-DEVIATION: account-alias-count-column (see SCHEMA_DEVIATIONS.md)
 *
 * The Mailing Lists list doesn't expose alias count as a column, only the
 * full `aliases` objectList on the detail view. Adds the same synthetic
 * `aliasCount` column already used on Accounts/Groups — DynamicList's
 * generic count-column handling picks it up with no further wiring.
 */
export function withMailingListColumns(schema: Schema): Schema {
  const list = schema.lists['x:MailingList'];
  if (!list) return schema;

  return {
    ...schema,
    lists: {
      ...schema.lists,
      'x:MailingList': { ...list, columns: [...list.columns, { name: 'aliasCount', label: 'Aliases' }] },
    },
  };
}
