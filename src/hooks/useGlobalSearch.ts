/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { List, Plus, Settings } from 'lucide-react';
import { useSchemaStore, type SearchIndexEntry } from '@/stores/schemaStore';
import { usePermissionCheckers } from '@/hooks/usePermissions';
import { isCreateOnly } from '@/lib/permissions';
import { resolveObject } from '@/lib/schemaResolver';
import { isLinkVisible } from '@/lib/layout';
import type { Schema } from '@/types/schema';

// SCHEMA-DEVIATION: community-overview-nav-entry / onboarding-checklist-nav-entry
// Appearance, Changelog and CustomComponent/* pages are not schema objects, so
// resolveObject() would drop them from the palette.
function isClientOnlySearchPage(viewName: string): boolean {
  return viewName === 'Appearance' || viewName === 'Changelog';
}

const MAX_RESULTS = 15;

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
  const deferredQuery = useDeferredValue(query);

  const schema = useSchemaStore((s) => s.schema);
  const searchIndex = useSchemaStore((s) => s.searchIndex);
  const { hasObjectPermission, canGet, hasPermission } = usePermissionCheckers();

  const results = useMemo(() => {
    if (!deferredQuery.trim() || !schema) return [];

    const tokens = deferredQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((s) => s.length > 0);
    if (tokens.length === 0) return [];

    const filtered = searchIndex.filter((entry) => {
      const haystack = (entry.text + ' ' + (entry.keywords?.join(' ') ?? '')).toLowerCase();
      for (const token of tokens) {
        if (!haystack.includes(token)) return false;
      }
      if (isClientOnlySearchPage(entry.viewName)) return true;
      if (entry.viewName.startsWith('CustomComponent/'))
        return isLinkVisible(schema, entry.viewName, canGet, hasPermission);
      const resolved = resolveObject(schema, entry.viewName);
      if (!resolved) return false;
      return hasObjectPermission(
        resolved.permissionPrefix,
        isCreateOnly(schema, resolved.permissionPrefix) ? 'Create' : 'Get',
      );
    });

    filtered.sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);
    return filtered.slice(0, MAX_RESULTS);
  }, [deferredQuery, searchIndex, schema, hasObjectPermission, canGet, hasPermission]);

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
      if (isClientOnlySearchPage(entry.viewName)) {
        navigate(`/${entry.viewName}`);
        onAfterSelect?.();
        return;
      }
      const objectKind = getObjectKind(schema, entry.viewName);
      navigate(getNavigationPath(entry.type, objectKind, entry.section, entry.viewName));
      onAfterSelect?.();
    },
    [schema, navigate, onAfterSelect],
  );

  const reset = useCallback(() => setQuery(''), []);

  return { query, setQuery, deferredQuery, results, groups, selectEntry, reset, schema };
}
