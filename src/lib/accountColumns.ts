/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { Schema } from '@/types/schema';

/**
 * The Accounts list only shows Email/Full Name/Created At, hiding role and
 * storage usage that otherwise require opening each account individually.
 * `createdAt` is dropped to make room; `roles` is a real property so it
 * renders through the normal field pipeline, but `quotaUsage` is synthetic
 * (not a real server property) — DynamicList resolves it to the
 * `usedDiskQuota` + `quotas.maxDiskQuota` pair and formats it specially.
 */
export function withAccountListColumns(schema: Schema): Schema {
  const list = schema.lists['x:Account/User'];
  if (!list) return schema;

  const columns = [
    ...list.columns.filter((c) => c.name !== 'createdAt'),
    { name: 'roles', label: 'Role' },
    { name: 'quotaUsage', label: 'Usage / Quota' },
  ];

  return {
    ...schema,
    lists: {
      ...schema.lists,
      'x:Account/User': { ...list, columns },
    },
  };
}
