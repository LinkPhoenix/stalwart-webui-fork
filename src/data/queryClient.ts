/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { QueryClient, type QueryKey } from '@tanstack/react-query';
import { isRetryableError } from '@/services/errors';
import { useAuthStore } from '@/stores/authStore';
import { jmapKeys } from '@/data/keys';

export const MAX_QUERY_RETRIES = 2;
export const DEFAULT_STALE_TIME = 30_000;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_QUERY_RETRIES && isRetryableError(error);
}

function isManagementKey(key: QueryKey): boolean {
  return typeof key[1] === 'string' && key[1].startsWith('x:');
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: shouldRetry,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export const queryClient = createQueryClient();

export function bindQueryClientToAuth(client: QueryClient): () => void {
  return useAuthStore.subscribe((state, prev) => {
    if (prev.accessToken !== null && state.accessToken === null) {
      client.clear();
      return;
    }
    if (prev.activeAccountId !== null && state.activeAccountId !== prev.activeAccountId) {
      void client.resetQueries({ queryKey: jmapKeys.all, predicate: (query) => !isManagementKey(query.queryKey) });
    }
  });
}
