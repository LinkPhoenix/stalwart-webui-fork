/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { jmapQuery } from '@/services/jmap/client';

/** Soft warning: still fetch, but tell the user the browser may struggle. */
export const FETCH_ALL_WARN_THRESHOLD = 2000;

/** Hard stop: refuse to pull the full result set into memory. */
export const FETCH_ALL_HARD_CAP = 10_000;

export type FetchAllProbe =
  { ok: true; total: number; warn: boolean } | { ok: false; total: number; reason: 'hard-cap' };

export function evaluateFetchAllTotal(total: number): FetchAllProbe {
  if (total > FETCH_ALL_HARD_CAP) {
    return { ok: false, total, reason: 'hard-cap' };
  }
  return { ok: true, total, warn: total > FETCH_ALL_WARN_THRESHOLD };
}

/**
 * Cheap total probe before a fetch-all path (client filters, mailbox tree,
 * client sort, problems-only, CSV export).
 */
export async function probeQueryTotal(
  objectType: string,
  queryOptions: { filter?: Record<string, unknown>; sort?: Record<string, unknown>[] } = {},
): Promise<number> {
  const data = await jmapQuery(objectType, {
    filter: queryOptions.filter,
    sort: queryOptions.sort,
    limit: 1,
    position: 0,
    calculateTotal: true,
  });
  return data.total ?? 0;
}
