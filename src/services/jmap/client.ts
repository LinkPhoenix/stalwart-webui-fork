/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useAuthStore } from '@/stores/authStore';
import { apiFetch } from '@/services/api';
import { logJmapExchange } from '@/lib/debug';
import type { JmapMethodCall, JmapMethodResponse, JmapQueryResponse, JmapResponse } from '@/types/jmap';
import type { Schema } from '@/types/schema';

const JMAP_USING = [
  'urn:ietf:params:jmap:core',
  'urn:stalwart:jmap',
  'urn:ietf:params:jmap:blob',
  'urn:ietf:params:jmap:mail',
  'urn:ietf:params:jmap:calendars',
  'urn:ietf:params:jmap:contacts',
  'urn:ietf:params:jmap:principals',
  'urn:ietf:params:jmap:sieve',
  'urn:ietf:params:jmap:vacationresponse',
];

export function getAccountId(objectType: string): string {
  const { primaryAccountId, activeAccountId } = useAuthStore.getState();
  if (objectType.startsWith('x:')) {
    if (!primaryAccountId) throw new Error('No primary account ID available');
    return primaryAccountId;
  }
  if (!activeAccountId) throw new Error('No active account ID available');
  return activeAccountId;
}

export async function jmapRequest(methodCalls: JmapMethodCall[], signal?: AbortSignal): Promise<JmapMethodResponse[]> {
  const { apiUrl } = useAuthStore.getState();
  let path = apiUrl || '/jmap';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      path = new URL(path).pathname;
    } catch {
      path = '/jmap';
    }
  }

  const startedAt = performance.now();
  const response = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      using: JMAP_USING,
      methodCalls,
    }),
    signal,
  });

  const data = (await response.json()) as JmapResponse;

  logJmapExchange(methodCalls, data.methodResponses, performance.now() - startedAt);

  if (import.meta.env.DEV) {
    for (const [methodName, result, callId] of data.methodResponses) {
      if (methodName === 'error') {
        console.error(`JMAP error [${callId}]:`, result);
      }
    }
  }

  return data.methodResponses;
}

export async function jmapGet(
  objectType: string,
  accountId: string,
  ids: string[] | null,
  properties?: string[],
  signal?: AbortSignal,
): Promise<JmapMethodResponse[]> {
  const args: Record<string, unknown> = { accountId, ids };
  if (properties) {
    args.properties = properties;
  }
  return jmapRequest([[`${objectType}/get`, args, '0']], signal);
}

interface JmapQueryOptions {
  filter?: Record<string, unknown>;
  sort?: Record<string, unknown>[];
  limit?: number;
  position?: number;
  anchor?: string;
  anchorOffset?: number;
  calculateTotal?: boolean;
}

export async function jmapQuery(
  objectType: string,
  accountId: string,
  options: JmapQueryOptions = {},
): Promise<JmapMethodResponse[]> {
  const args: Record<string, unknown> = { accountId, ...options };
  return jmapRequest([[`${objectType}/query`, args, '0']]);
}

interface JmapSetOptions {
  create?: Record<string, Record<string, unknown>>;
  update?: Record<string, Record<string, unknown>>;
  destroy?: string[];
}

export async function jmapSet(
  objectType: string,
  accountId: string,
  options: JmapSetOptions = {},
): Promise<JmapMethodResponse[]> {
  const args: Record<string, unknown> = { accountId, ...options };
  return jmapRequest([[`${objectType}/set`, args, '0']]);
}

export async function jmapQueryAndGet(
  objectType: string,
  accountId: string,
  queryOptions: JmapQueryOptions = {},
  properties?: string[],
): Promise<JmapMethodResponse[]> {
  const queryArgs: Record<string, unknown> = {
    accountId,
    ...queryOptions,
  };

  const getArgs: Record<string, unknown> = {
    accountId,
    '#ids': {
      resultOf: '0',
      name: `${objectType}/query`,
      path: '/ids',
    },
  };
  if (properties) {
    getArgs.properties = properties;
  }

  return jmapRequest([
    [`${objectType}/query`, queryArgs, '0'],
    [`${objectType}/get`, getArgs, '1'],
  ]);
}

export async function jmapGetBatched(
  objectType: string,
  accountId: string,
  ids: string[],
  properties?: string[],
  signal?: AbortSignal,
): Promise<Record<string, unknown>[]> {
  if (ids.length === 0) return [];

  const batchSize = useAuthStore.getState().maxObjectsInGet;
  const allItems: Record<string, unknown>[] = [];

  for (let offset = 0; offset < ids.length; offset += batchSize) {
    if (signal?.aborted) break;
    const batchIds = ids.slice(offset, offset + batchSize);
    const args: Record<string, unknown> = { accountId, ids: batchIds };
    if (properties) args.properties = properties;
    const responses = await jmapRequest([[`${objectType}/get`, args, '0']], signal);
    const result = responses[0];
    if (result[0] === 'error') {
      throw new Error(`JMAP ${objectType}/get error: ${(result[1] as Record<string, unknown>).type ?? 'unknown'}`);
    }
    const list = (result[1] as { list?: Record<string, unknown>[] }).list ?? [];
    allItems.push(...list);
  }

  // /get does not guarantee request order, including within each batch.
  const itemsById = new Map(allItems.map((item) => [item.id, item]));
  return ids.flatMap((id) => {
    const item = itemsById.get(id);
    return item ? [item] : [];
  });
}

export async function jmapQueryAll(
  objectType: string,
  accountId: string,
  queryOptions: JmapQueryOptions = {},
  signal?: AbortSignal,
): Promise<string[]> {
  const allIds: string[] = [];
  let anchor: string | undefined;
  const MAX_PAGES = 1000;
  for (let page = 0; page < MAX_PAGES; page++) {
    if (signal?.aborted) break;

    const args: Record<string, unknown> = { accountId, ...queryOptions };
    if (anchor) {
      delete args.position;
      args.anchor = anchor;
      args.anchorOffset = 1;
    }

    const responses = await jmapRequest([[`${objectType}/query`, args, '0']], signal);
    const result = responses[0];
    if (result[0] === 'error') {
      throw new Error(`JMAP ${objectType}/query error: ${(result[1] as Record<string, unknown>).type ?? 'unknown'}`);
    }

    const data = result[1] as unknown as JmapQueryResponse;
    const pageIds = data.ids ?? [];
    if (pageIds.length === 0) break;

    allIds.push(...pageIds);

    if (data.limit === undefined || data.limit === null) break;

    anchor = pageIds[pageIds.length - 1];
  }

  return allIds;
}

export async function jmapQueryAllAndGet(
  objectType: string,
  accountId: string,
  queryOptions: JmapQueryOptions = {},
  properties?: string[],
  signal?: AbortSignal,
): Promise<{ ids: string[]; list: Record<string, unknown>[] }> {
  const ids = await jmapQueryAll(objectType, accountId, queryOptions, signal);
  if (ids.length === 0) return { ids, list: [] };
  const list = await jmapGetBatched(objectType, accountId, ids, properties, signal);
  return { ids, list };
}

export async function fetchSession(): Promise<Record<string, unknown>> {
  const response = await apiFetch('/jmap/session');
  return response.json() as Promise<Record<string, unknown>>;
}

export async function fetchSchema(): Promise<Schema> {
  const response = await apiFetch('/api/schema');
  return response.json() as Promise<Schema>;
}

interface AccountInfoResponse {
  permissions: string[];
  edition: 'enterprise' | 'community' | 'oss';
  locale: string;
}

export async function fetchAccountInfo(): Promise<AccountInfoResponse> {
  const response = await apiFetch('/api/account');
  return response.json() as Promise<AccountInfoResponse>;
}
