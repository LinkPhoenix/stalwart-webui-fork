/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { resolveObject, resolveList, getDisplayProperty } from '@/lib/schemaResolver';
import { jmapGetBatched, jmapQueryAllAndGet, getAccountId } from '@/services/jmap/client';
import { useAccountStore } from '@/stores/accountStore';
import { useCacheStore, type ObjectListEntry } from '@/stores/cacheStore';
import type { Schema } from '@/types/schema';

interface PendingBatch {
  ids: Set<string>;
  displayProp: string;
  schema: Schema;
}

const pendingByType = new Map<string, PendingBatch>();

export function coerceLabel(value: unknown, fallback: string): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value))
    return value.length > 0
      ? value
          .map((v) => coerceLabel(v, ''))
          .filter(Boolean)
          .join(', ')
      : fallback;
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    return keys.length > 0 ? keys.join(', ') : fallback;
  }
  return fallback;
}

function requestObjectLabel(parentObjectName: string, viewOrObjectName: string, id: string, schema: Schema): void {
  const existing = pendingByType.get(parentObjectName);
  if (existing) {
    existing.ids.add(id);
    return;
  }

  const batch: PendingBatch = {
    ids: new Set([id]),
    displayProp: getDisplayProperty(schema, viewOrObjectName),
    schema,
  };
  pendingByType.set(parentObjectName, batch);

  queueMicrotask(() => {
    const taken = pendingByType.get(parentObjectName);
    if (taken !== batch) return;
    pendingByType.delete(parentObjectName);
    void executeBatch(parentObjectName, taken);
  });
}

async function executeBatch(parentObjectName: string, batch: PendingBatch): Promise<void> {
  const ids = Array.from(batch.ids);
  const setDisplayNames = useCacheStore.getState().setDisplayNames;

  try {
    const accountId = getAccountId(parentObjectName);
    const list = await jmapGetBatched(parentObjectName, accountId, ids, ['id', batch.displayProp]);
    const entries: Record<string, string> = {};
    for (const item of list) {
      const itemId = item.id as string;
      if (!itemId) continue;
      entries[itemId] = coerceLabel(item[batch.displayProp], itemId);
    }
    for (const id of ids) {
      if (!(id in entries)) entries[id] = id;
    }
    setDisplayNames(parentObjectName, entries);
  } catch (err) {
    console.error('Failed to batch-fetch labels for', parentObjectName, err);
    const fallback: Record<string, string> = {};
    for (const id of ids) fallback[id] = id;
    setDisplayNames(parentObjectName, fallback);
  }
}

export type ObjectOption = ObjectListEntry;

async function fetchObjectList(viewOrObjectName: string, schema: Schema): Promise<ObjectOption[]> {
  const resolved = resolveObject(schema, viewOrObjectName);
  const objectName = resolved?.objectName ?? viewOrObjectName;
  const list = resolveList(schema, viewOrObjectName, objectName);
  const filtersStatic = list?.filtersStatic;

  const accountId = getAccountId(objectName);
  const displayProp = getDisplayProperty(schema, viewOrObjectName);

  let items: Array<Record<string, unknown>>;
  try {
    const result = await jmapQueryAllAndGet(
      objectName,
      accountId,
      { filter: filtersStatic && Object.keys(filtersStatic).length > 0 ? filtersStatic : undefined },
      ['id', displayProp],
    );
    items = result.list;
  } catch (err) {
    console.error('JMAP error fetching', viewOrObjectName, err);
    return [];
  }

  return items.map((item) => ({
    id: item.id as string,
    label: coerceLabel(item[displayProp], item.id as string),
  }));
}

export function useObjectList(viewOrObjectName: string, schema: Schema) {
  const cached = useCacheStore((s) => s.objectLists[viewOrObjectName]);
  const setObjectList = useCacheStore((s) => s.setObjectList);
  const [loading, setLoading] = useState(false);

  const ensureLoaded = useCallback(async () => {
    if (cached) return;
    setLoading(true);
    try {
      const opts = await fetchObjectList(viewOrObjectName, schema);
      setObjectList(viewOrObjectName, opts);
    } catch (err) {
      console.error('Failed to fetch objects for', viewOrObjectName, err);
    } finally {
      setLoading(false);
    }
  }, [cached, viewOrObjectName, schema, setObjectList]);

  return { options: cached ?? [], loading, hasLoaded: cached != null, ensureLoaded };
}

export function useObjectLabel(
  viewOrObjectName: string,
  id: string | null | undefined,
  schema: Schema,
): { label: string | null; loading: boolean } {
  const resolved = resolveObject(schema, viewOrObjectName);
  const parentObjectName = resolved?.objectName ?? viewOrObjectName;
  const cachedLabel = useCacheStore((s) => (id ? s.displayNames[parentObjectName]?.[id] : undefined));

  useEffect(() => {
    if (!id) return;
    if (cachedLabel != null) return;
    requestObjectLabel(parentObjectName, viewOrObjectName, id, schema);
  }, [id, cachedLabel, parentObjectName, viewOrObjectName, schema]);

  return {
    label: cachedLabel ?? null,
    loading: !!id && cachedLabel == null,
  };
}

export function objectSupportsSearch(schema: Schema, objectName: string): boolean {
  const resolved = resolveObject(schema, objectName);
  if (!resolved) return false;
  const list = resolveList(schema, objectName, resolved.objectName);
  return list?.filters?.some((f) => f.type === 'text') ?? false;
}

export function useNoPermissionMessage(schema: Schema, viewOrObjectName: string): string | null {
  const { t } = useTranslation();
  const hasObjectPermission = useAccountStore((s) => s.hasObjectPermission);
  const resolved = resolveObject(schema, viewOrObjectName);
  if (!resolved) return null;
  const prefix = resolved.permissionPrefix;
  if (hasObjectPermission(prefix, 'Get') && hasObjectPermission(prefix, 'Query')) return null;
  const list = resolveList(schema, viewOrObjectName, resolved.objectName);
  const name = list?.pluralName ?? resolved.objectName;
  return t('field.noPermissionToView', 'You do not have permission to view {{name}}', { name });
}
