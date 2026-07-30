/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { List, Plus, Settings } from 'lucide-react';
import { useSchemaStore, type SearchIndexEntry } from '@/stores/schemaStore';
import { useAccountStore } from '@/stores/accountStore';
import { resolveObject } from '@/lib/schemaResolver';
import type { Schema } from '@/types/schema';

const MAX_RESULTS = 15;
const DEBOUNCE_MS = 300;

const TYPE_ORDER: Record<SearchIndexEntry['type'], number> = {
  link: 0,
  form: 1,
  field: 2,
};

export type ObjectKind = 'singleton' | 'object' | null;

export function getObjectKind(schema: Schema, viewName: string): ObjectKind {
  const resolved = resolveObject(schema, viewName);
  if (!resolved) return null;
  return resolved.objectType.type === 'singleton' ? 'singleton' : 'object';
}

export function getActionInfo(
  entryType: SearchIndexEntry['type'],
  objectKind: ObjectKind,
  t: (key: string, fallback: string) => string,
): { label: string; Icon: typeof List } {
  if (objectKind === 'singleton') {
    return { label: t('globalSearch.settings', 'Settings'), Icon: Settings };
  }
  return entryType === 'link'
    ? { label: t('globalSearch.list', 'List'), Icon: List }
    : { label: t('globalSearch.create', 'Create'), Icon: Plus };
}

function getNavigationPath(
  entryType: SearchIndexEntry['type'],
  objectKind: ObjectKind,
  section: string,
  viewName: string,
): string {
  if (objectKind === 'singleton') return `/${section}/${viewName}/singleton`;
  return entryType === 'link' ? `/${section}/${viewName}` : `/${section}/${viewName}/new`;
}

export function friendlyName(viewName: string): string {
  const stripped = viewName.replace(/^x:/, '');
  const parts = stripped.split('/');
  return parts[parts.length - 1];
}

export function useGlobalSearch(onAfterSelect?: () => void) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schema = useSchemaStore((s) => s.schema);
  const searchIndex = useSchemaStore((s) => s.searchIndex);
  const hasObjectPermission = useAccountStore((s) => s.hasObjectPermission);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(value), DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const results = useMemo(() => {
    if (!debouncedQuery.trim() || !schema) return [];

    const tokens = debouncedQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((s) => s.length > 0);
    if (tokens.length === 0) return [];

    const filtered = searchIndex.filter((entry) => {
      const haystack = (entry.text + ' ' + (entry.keywords?.join(' ') ?? '')).toLowerCase();
      for (const token of tokens) {
        if (!haystack.includes(token)) return false;
      }
      const resolved = resolveObject(schema, entry.viewName);
      if (!resolved) return false;
      return hasObjectPermission(resolved.permissionPrefix, 'Get');
    });

    filtered.sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);
    return filtered.slice(0, MAX_RESULTS);
  }, [debouncedQuery, searchIndex, schema, hasObjectPermission]);

  const groups = useMemo(() => {
    const map = new Map<SearchIndexEntry['type'], SearchIndexEntry[]>();
    for (const entry of results) {
      const arr = map.get(entry.type);
      if (arr) arr.push(entry);
      else map.set(entry.type, [entry]);
    }
    return map;
  }, [results]);

  const selectEntry = useCallback(
    (entry: SearchIndexEntry) => {
      if (!schema) return;
      const objectKind = getObjectKind(schema, entry.viewName);
      navigate(getNavigationPath(entry.type, objectKind, entry.section, entry.viewName));
      onAfterSelect?.();
    },
    [schema, navigate, onAfterSelect],
  );

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setQuery('');
    setDebouncedQuery('');
  }, []);

  return { query, setQuery: handleQueryChange, debouncedQuery, results, groups, selectEntry, reset, schema };
}
