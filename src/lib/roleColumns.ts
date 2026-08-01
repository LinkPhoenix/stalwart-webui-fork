/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { Schema } from '@/types/schema';

/**
 * SCHEMA-DEVIATION: role-permission-count-columns (see SCHEMA_DEVIATIONS.md)
 *
 * The Roles list only shows Description, hiding how many permissions a
 * role actually grants or explicitly revokes without opening it. Adds two
 * synthetic columns — DynamicList's generic count-column handling
 * resolves them from the real `enabledPermissions`/`disabledPermissions`
 * set properties and renders their entry counts.
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
          ...list.columns,
          { name: 'enabledPermissionCount', label: 'Enabled Permissions' },
          { name: 'disabledPermissionCount', label: 'Disabled Permissions' },
        ],
      },
    },
  };
}
