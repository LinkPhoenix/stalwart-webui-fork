/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { Schema } from '@/types/schema';
import type { ClientOnlyFilterEnum } from './schemaDeviationTypes';

/**
 * SCHEMA-DEVIATION: log-client-filters (see SCHEMA_DEVIATIONS.md)
 *
 * The Stalwart JMAP backend rejects `level`/`event` as filter conditions on
 * `x:Log/query` (`unsupportedFilter`), even though both properties are
 * already returned per row. Until the backend adds real support, these two
 * filters are appended client-side and applied entirely in the browser
 * (see the `clientOnly` flag consumed by DynamicList) instead of being sent
 * to the server.
 */
export function withClientLogFilters(schema: Schema): Schema {
  const logList = schema.lists['x:Log'];
  if (!logList || !schema.enums['TracingLevel'] || !schema.enums['EventType']) return schema;

  const levelFilter: ClientOnlyFilterEnum = {
    type: 'enum',
    field: 'level',
    enumName: 'TracingLevel',
    label: 'Level',
    clientOnly: true,
  };
  const eventFilter: ClientOnlyFilterEnum = {
    type: 'enum',
    field: 'event',
    enumName: 'EventType',
    label: 'Event',
    clientOnly: true,
  };

  return {
    ...schema,
    lists: {
      ...schema.lists,
      'x:Log': {
        ...logList,
        filters: [...(logList.filters ?? []), levelFilter, eventFilter],
      },
    },
  };
}
