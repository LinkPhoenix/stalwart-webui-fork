/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useCallback, useState } from 'react';
import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { jmapKeys } from '@/data/keys';
import { loadDisplayName } from '@/data/displayNames';
import { coerceLabel } from '@/lib/objectOptions';
import { getDisplayProperty, isTenantScoped, resolveList, resolveObject, TENANT_PROPERTY } from '@/lib/schemaResolver';
import { jmapQueryAllAndGet } from '@/services/jmap/client';
import type { Schema } from '@/types/schema';

export interface ObjectOption {
  id: string;
  label: string;
}

function parentObjectName(schema: Schema, viewOrObjectName: string): string {
  return resolveObject(schema, viewOrObjectName)?.objectName ?? viewOrObjectName;
}

function cachedOptionLabel(
  client: QueryClient,
  schema: Schema,
  objectName: string,
  displayProperty: string,
  id: string,
): string | undefined {
  for (const [key, options] of client.getQueriesData<ObjectOption[]>({ queryKey: jmapKeys.allOptions(objectName) })) {
    const view = key[3];
    if (!options || typeof view !== 'string' || getDisplayProperty(schema, view) !== displayProperty) continue;
    const hit = options.find((option) => option.id === id);
    if (hit) return hit.label;
  }
  return undefined;
}

export function displayNameQuery(schema: Schema, viewOrObjectName: string, id: string, client: QueryClient) {
  const objectName = parentObjectName(schema, viewOrObjectName);
  const displayProperty = getDisplayProperty(schema, viewOrObjectName);
  return queryOptions({
    queryKey: jmapKeys.displayName(objectName, displayProperty, id),
    queryFn: ({ signal }) => loadDisplayName(objectName, displayProperty, id, signal),
    initialData: () => cachedOptionLabel(client, schema, objectName, displayProperty, id),
  });
}

export function objectOptionsQuery(schema: Schema, viewOrObjectName: string, tenantId: string | null = null) {
  const objectName = parentObjectName(schema, viewOrObjectName);
  const displayProperty = getDisplayProperty(schema, viewOrObjectName);
  const scopedTenantId = tenantId !== null && isTenantScoped(schema, viewOrObjectName) ? tenantId : null;
  return queryOptions({
    queryKey: jmapKeys.options(objectName, viewOrObjectName, scopedTenantId),
    queryFn: async ({ signal }): Promise<ObjectOption[]> => {
      const filtersStatic = resolveList(schema, viewOrObjectName, objectName)?.filtersStatic;
      const filter =
        scopedTenantId !== null
          ? { ...filtersStatic, [TENANT_PROPERTY]: scopedTenantId }
          : filtersStatic && Object.keys(filtersStatic).length > 0
            ? filtersStatic
            : undefined;
      const { list } = await jmapQueryAllAndGet(objectName, { filter }, ['id', displayProperty], { signal });
      const options: ObjectOption[] = [];
      for (const item of list) {
        if (typeof item.id !== 'string') continue;
        options.push({ id: item.id, label: coerceLabel(item[displayProperty], item.id) });
      }
      return options;
    },
  });
}

const EMPTY_OPTIONS: ObjectOption[] = [];

export function useObjectOptions(viewOrObjectName: string, schema: Schema, tenantId: string | null = null) {
  const [requested, setRequested] = useState(false);
  const query = useQuery({
    ...objectOptionsQuery(schema, viewOrObjectName, tenantId),
    enabled: requested,
  });
  const { isError, refetch } = query;
  const ensureLoaded = useCallback(() => {
    setRequested(true);
    if (isError) void refetch();
  }, [isError, refetch]);
  return {
    options: query.data ?? EMPTY_OPTIONS,
    loading: query.isFetching && query.data === undefined,
    hasLoaded: query.data !== undefined,
    error: query.error,
    ensureLoaded,
  };
}

export function useDisplayName(
  viewOrObjectName: string,
  id: string | null | undefined,
  schema: Schema,
): { label: string | null; loading: boolean; error: Error | null } {
  const client = useQueryClient();
  const query = useQuery({
    ...displayNameQuery(schema, viewOrObjectName, id ?? '', client),
    enabled: !!id,
  });
  return {
    label: query.data ?? null,
    loading: !!id && query.isPending && query.fetchStatus !== 'idle',
    error: query.error,
  };
}
