/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { isLinkAccessible } from '@/lib/layout';
import type { Schema } from '@/types/schema';

export const QUEUE_DELIVERY_TRACE_VIEW = 'CustomComponent/LiveDelivery';
export const QUEUE_LOG_ENTRIES_VIEW = 'x:Log';

export interface QueueOpsLink {
  viewName: string;
  href: string;
  labelKey: [string, string];
}

/**
 * Community-friendly ops shortcuts from the queued-messages list.
 * Presentational only — links resolve through layout visibility + section map.
 */
export function buildQueueOpsLinks(
  schema: Schema,
  viewToSection: Record<string, string>,
  edition: string,
  canGet: (permissionPrefix: string) => boolean,
  hasPerm: (perm: string) => boolean,
): QueueOpsLink[] {
  const candidates: { viewName: string; labelKey: [string, string] }[] = [
    {
      viewName: QUEUE_DELIVERY_TRACE_VIEW,
      labelKey: ['list.queueLinkDeliveryTrace', 'Delivery Trace'],
    },
    {
      viewName: QUEUE_LOG_ENTRIES_VIEW,
      labelKey: ['list.queueLinkLogs', 'Log Entries'],
    },
  ];

  const links: QueueOpsLink[] = [];
  for (const candidate of candidates) {
    if (!isLinkAccessible(schema, candidate.viewName, edition, canGet, hasPerm)) continue;
    const section = viewToSection[candidate.viewName] ?? 'Management';
    links.push({
      viewName: candidate.viewName,
      href: `/${section}/${candidate.viewName}`,
      labelKey: candidate.labelKey,
    });
  }
  return links;
}
