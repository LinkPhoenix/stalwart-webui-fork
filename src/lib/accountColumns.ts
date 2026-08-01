/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { Schema } from '@/types/schema';

/**
 * SCHEMA-DEVIATION: account-quota-usage-column (see SCHEMA_DEVIATIONS.md)
 *
 * The Accounts list only shows Email/Full Name/Created At, hiding role and
 * storage usage that otherwise require opening each account individually.
 * `createdAt` is dropped to make room; `roles` is a real property so it
 * renders through the normal field pipeline, but `quotaUsage` is synthetic
 * (not a real server property) — DynamicList resolves it to the
 * `usedDiskQuota` + `quotas.maxDiskQuota` pair and formats it specially.
 *
 * The Groups list gets the same `quotaUsage` column (groups have their own
 * `usedDiskQuota`/`quotas`, same as users), but not `roles` — that column
 * is specific to the Users list.
 *
 * SCHEMA-DEVIATION: account-alias-count-column (see SCHEMA_DEVIATIONS.md)
 *
 * Both lists also get a synthetic `aliasCount` column — DynamicList
 * resolves it from the real `aliases` objectList property (an id-keyed
 * map, per JMAP's objectList wire format) and renders its entry count.
 */
export function withAccountListColumns(schema: Schema): Schema {
  let lists = schema.lists;

  const userList = lists['x:Account/User'];
  if (userList) {
    const columns = [
      ...userList.columns.filter((c) => c.name !== 'createdAt'),
      { name: 'roles', label: 'Role' },
      { name: 'quotaUsage', label: 'Usage / Quota' },
      { name: 'aliasCount', label: 'Aliases' },
    ];
    lists = { ...lists, 'x:Account/User': { ...userList, columns } };
  }

  const groupList = lists['x:Account/Group'];
  if (groupList) {
    const columns = [
      ...groupList.columns,
      { name: 'quotaUsage', label: 'Usage / Quota' },
      { name: 'aliasCount', label: 'Aliases' },
    ];
    lists = { ...lists, 'x:Account/Group': { ...groupList, columns } };
  }

  return { ...schema, lists };
}
