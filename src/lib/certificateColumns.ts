/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { Schema } from '@/types/schema';
import { clientSortable } from './schemaDeviationTypes';

/**
 * SCHEMA-DEVIATION: certificate-validity-status-column (see SCHEMA_DEVIATIONS.md)
 *
 * The x:Certificate list only exposes Subject Alternative Names, so there is
 * no way to see at a glance which certificate is valid, expiring soon or
 * expired (the Overview card aggregates this, but the list itself shows
 * nothing). Adds a synthetic `validityStatus` column computed from the real
 * `notValidAfter` property with the same rules as the Overview card
 * (src/lib/certificateValidity.ts): missing/unparseable or past date =
 * expired, within 30 days = expiring soon, otherwise valid.
 *
 * Tagged `clientSortable` — like every other list, x:Certificate declares no
 * `list.sort`, so sorting goes through the generic client-sort path
 * (SCHEMA-DEVIATION: account-client-sort).
 */
export function withCertificateColumns(schema: Schema): Schema {
  const list = schema.lists['x:Certificate'];
  if (!list) return schema;

  return {
    ...schema,
    lists: {
      ...schema.lists,
      'x:Certificate': {
        ...list,
        columns: [...list.columns, clientSortable({ name: 'validityStatus', label: 'Status' })],
      },
    },
  };
}
