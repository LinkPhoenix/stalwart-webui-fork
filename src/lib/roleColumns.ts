/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { Schema } from '@/types/schema';
import { clientSortable } from './schemaDeviationTypes';

/**
 * SCHEMA-DEVIATION: role-permission-count-columns (see SCHEMA_DEVIATIONS.md)
 *
 * The Roles list only shows Description, hiding how many permissions a
 * role actually grants or explicitly revokes without opening it. Adds two
 * synthetic columns — DynamicList's generic count-column handling
 * resolves them from the real `enabledPermissions`/`disabledPermissions`
 * set properties and renders their entry counts.
 *
 * SCHEMA-DEVIATION: account-client-sort (see SCHEMA_DEVIATIONS.md)
 *
 * Description and both permission-count columns are tagged
 * `clientSortable` — same reasoning as Accounts/Groups: the server
 * doesn't support sorting on any `x:Role` property either.
 */
export function withRoleListColumns(schema: Schema): Schema {
  const list = schema.lists['x:Role'];
  if (!list) return schema;

  return {
    ...schema,
    lists: {
      ...schema.lists,
      'x:Role': {
        ...list,
        columns: [
          ...list.columns.map((c) => (c.name === 'description' ? clientSortable(c) : c)),
          clientSortable({ name: 'enabledPermissionCount', label: 'Enabled Permissions' }),
          clientSortable({ name: 'disabledPermissionCount', label: 'Disabled Permissions' }),
        ],
      },
    },
  };
}
