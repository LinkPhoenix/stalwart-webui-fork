/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { describe, expect, it } from 'vitest';
import type { Schema } from '@/types/schema';
import { buildQueueOpsLinks, QUEUE_DELIVERY_TRACE_VIEW, QUEUE_LOG_ENTRIES_VIEW } from './queueOpsLinks';

function schemaStub(): Schema {
  return {
    objects: {
      [QUEUE_LOG_ENTRIES_VIEW]: {
        type: 'object',
        permissionPrefix: 'sysLog',
      } as never,
    },
    schemas: {},
    fields: {},
    forms: {},
    lists: {},
    enums: {},
    dashboards: [],
    layouts: [],
  };
}

describe('buildQueueOpsLinks', () => {
  it('includes Delivery Trace when liveDeliveryTest is allowed', () => {
    const links = buildQueueOpsLinks(
      schemaStub(),
      { [QUEUE_DELIVERY_TRACE_VIEW]: 'Troubleshoot', [QUEUE_LOG_ENTRIES_VIEW]: 'Management' },
      'community',
      (prefix) => prefix === 'sysLog',
      (perm) => perm === 'liveDeliveryTest',
    );
    expect(links.map((l) => l.viewName)).toEqual([QUEUE_DELIVERY_TRACE_VIEW, QUEUE_LOG_ENTRIES_VIEW]);
    expect(links[0].href).toBe(`/Troubleshoot/${QUEUE_DELIVERY_TRACE_VIEW}`);
  });

  it('omits Delivery Trace without permission', () => {
    const links = buildQueueOpsLinks(
      schemaStub(),
      { [QUEUE_LOG_ENTRIES_VIEW]: 'Management' },
      'community',
      (prefix) => prefix === 'sysLog',
      () => false,
    );
    expect(links.map((l) => l.viewName)).toEqual([QUEUE_LOG_ENTRIES_VIEW]);
  });
});
