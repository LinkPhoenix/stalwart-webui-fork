/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Plus,
  Check,
  X,
  ArrowUpDown,
  Filter,
  Loader2,
  Lock,
  Search,
  RotateCcw,
  RefreshCw,
  CornerDownRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { formatSize as fmtSize, formatDuration as fmtDuration } from '@/lib/durationFormat';
import { SizeDisplay } from '@/components/common/SizeDisplay';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ObjectPicker } from '@/components/common/ObjectPicker';
import { EnterpriseUpsell } from '@/components/common/EnterpriseUpsell';
import { toast } from '@/hooks/use-toast';
import { friendlySetError } from '@/lib/jmapErrors';
import { coerceLabel } from '@/lib/objectOptions';
import { buildJmapFilter } from '@/lib/listFilter';
import { useResetOnChange } from '@/hooks/useBufferedValue';

import { useSchemaStore } from '@/stores/schemaStore';
import { useAuthStore } from '@/stores/authStore';
import { useAccountStore } from '@/stores/accountStore';
import { useCacheStore } from '@/stores/cacheStore';
import { resolveObject, resolveSchema, resolveList, getDisplayProperty } from '@/lib/schemaResolver';
import {
  jmapGetBatched,
  jmapQueryAll,
  jmapQueryAndGet,
  jmapQueryAllAndGet,
  jmapSet,
  getAccountId,
} from '@/services/jmap/client';

import type { Schema, Field, MassAction, ItemAction, Filter as FilterDef } from '@/types/schema';
import type { JmapSetResponse, JmapSetError } from '@/types/jmap';
import type { ResolvedSchema } from '@/lib/schemaResolver';
import { isClientOnlyFilterEnum } from '@/lib/schemaDeviationTypes';

const PAGE_SIZE = 25;
const MAX_REPORTED_ERRORS = 3;
// Combobox threshold: plain <Select> is fine for a handful of options, but
// unusable (no search) once an enum has dozens of entries.
const ENUM_COMBOBOX_THRESHOLD = 15;
// Manual refresh on the Logs list is rate-limited to avoid hammering the
// server if someone leaves it clicked repeatedly.
const REFRESH_COOLDOWN_MS = 5000;

function isClientOnlyFilter(f: FilterDef): boolean {
  return f.type === 'enum' && isClientOnlyFilterEnum(f);
}

function parseSetResponse(raw: [string, Record<string, unknown>, string][]): JmapSetResponse | null {
  const entry = raw.find(([name]) => name.endsWith('/set'));
  return entry ? (entry[1] as unknown as JmapSetResponse) : null;
}

type BulkActionType = 'delete' | 'update';
type TFn = (key: string, fallback: string, options?: Record<string, unknown>) => string;

function bulkResultSummary(
  successCount: number,
  errors: Record<string, JmapSetError> | null,
  actionType: BulkActionType,
  t: TFn,
): { title: string; description?: string; variant: 'success' | 'destructive' } | null {
  const errorEntries = errors ? Object.entries(errors) : [];
  const totalErrors = errorEntries.length;

  if (totalErrors === 0 && successCount > 0) {
    const title =
      actionType === 'delete'
        ? successCount === 1
          ? t('list.bulkSuccessDelete_one', '{{count}} item deleted successfully.', { count: successCount })
          : t('list.bulkSuccessDelete_other', '{{count}} items deleted successfully.', { count: successCount })
        : successCount === 1
          ? t('list.bulkSuccessUpdate_one', '{{count}} item updated successfully.', { count: successCount })
          : t('list.bulkSuccessUpdate_other', '{{count}} items updated successfully.', { count: successCount });
    return {
      title,
      variant: 'success',
    };
  }

  const msgCounts = new Map<string, number>();
  for (const [, e] of errorEntries) {
    const msg = friendlySetError(e);
    msgCounts.set(msg, (msgCounts.get(msg) ?? 0) + 1);
  }
  const lines: string[] = [];
  let accounted = 0;
  for (const [msg, count] of msgCounts) {
    if (lines.length >= MAX_REPORTED_ERRORS) break;
    lines.push(count > 1 ? t('list.bulkErrorGrouped', '{{count}} items: {{message}}', { count, message: msg }) : msg);
    accounted += count;
  }
  if (accounted < totalErrors) {
    lines.push(t('list.bulkErrorMore', '…and {{count}} more.', { count: totalErrors - accounted }));
  }
  const description = lines.join('\n');

  if (successCount === 0) {
    const title =
      actionType === 'delete'
        ? totalErrors === 1
          ? t('list.bulkFailDelete_one', 'Failed to delete {{count}} item.', { count: totalErrors })
          : t('list.bulkFailDelete_other', 'Failed to delete {{count}} items.', { count: totalErrors })
        : totalErrors === 1
          ? t('list.bulkFailUpdate_one', 'Failed to update {{count}} item.', { count: totalErrors })
          : t('list.bulkFailUpdate_other', 'Failed to update {{count}} items.', { count: totalErrors });
    return {
      title,
      description,
      variant: 'destructive',
    };
  }

  const title =
    actionType === 'delete'
      ? t('list.bulkMixedDelete', '{{success}} deleted, {{failed}} failed.', {
          success: successCount,
          failed: totalErrors,
        })
      : t('list.bulkMixedUpdate', '{{success}} updated, {{failed}} failed.', {
          success: successCount,
          failed: totalErrors,
        });
  return {
    title,
    description,
    variant: 'destructive',
  };
}

function formatSize(bytes: unknown): string {
  if (bytes == null || typeof bytes !== 'number') return '';
  return fmtSize(bytes);
}

function formatDuration(ms: unknown): string {
  if (ms == null || typeof ms !== 'number') return '';
  return fmtDuration(ms);
}

function formatNumber(value: unknown): string {
  if (value == null || typeof value !== 'number') return '';
  return value.toLocaleString();
}

// SCHEMA-DEVIATION: mailbox-client-hierarchy-sort (see SCHEMA_DEVIATIONS.md)
//
// Orders mailboxes so each parent is immediately followed by its
// descendants (siblings alphabetical), and records each row's depth.
// Requires the full set (not just one page) since a mailbox's parent
// could be on a different page than the mailbox itself.
function sortMailboxesByHierarchy(items: Record<string, unknown>[]): {
  items: Record<string, unknown>[];
  depths: Map<string, number>;
} {
  const byId = new Set(items.map((item) => item.id as string));
  const childrenOf = new Map<string, Record<string, unknown>[]>();
  const roots: Record<string, unknown>[] = [];

  for (const item of items) {
    const parentId = item.parentId as string | null | undefined;
    if (parentId && byId.has(parentId)) {
      const siblings = childrenOf.get(parentId) ?? [];
      siblings.push(item);
      childrenOf.set(parentId, siblings);
    } else {
      roots.push(item);
    }
  }

  const byName = (a: Record<string, unknown>, b: Record<string, unknown>) =>
    String(a.name ?? '').localeCompare(String(b.name ?? ''));
  roots.sort(byName);
  for (const siblings of childrenOf.values()) siblings.sort(byName);

  const ordered: Record<string, unknown>[] = [];
  const depths = new Map<string, number>();

  function visit(item: Record<string, unknown>, depth: number) {
    ordered.push(item);
    depths.set(item.id as string, depth);
    for (const child of childrenOf.get(item.id as string) ?? []) {
      visit(child, depth + 1);
    }
  }
  for (const root of roots) visit(root, 0);

  return { items: ordered, depths };
}

function formatUserRole(item: Record<string, unknown>, schema: Schema): React.ReactNode {
  // The x:Account list merges field definitions across its User/Group
  // variants (see getFieldsRecord), and Group's `roles` property points to
  // a different object (`x:Roles`) that overrides User's (`x:UserRoles`)
  // in that merge. This list only ever shows Users, so resolve the label
  // directly against x:UserRoles instead of the ambiguous merged field.
  const roles = item.roles as Record<string, unknown> | undefined;
  const type = roles && typeof roles['@type'] === 'string' ? roles['@type'] : undefined;
  if (!type) return <span className="text-muted-foreground">-</span>;

  const variantSchema = schema.schemas['x:UserRoles'];
  if (variantSchema?.type === 'multiple') {
    const variant = variantSchema.variants.find((v) => v.name === type);
    if (variant) return <Badge variant="secondary">{variant.label}</Badge>;
  }
  return type;
}

function renderQuotaUsage(item: Record<string, unknown>, t: TFn): React.ReactNode {
  const rawUsed = typeof item.usedDiskQuota === 'number' ? item.usedDiskQuota : 0;
  const used = Number.isFinite(rawUsed) ? rawUsed : 0;
  const quotas = item.quotas as Record<string, unknown> | undefined;
  const rawLimit = quotas && typeof quotas.maxDiskQuota === 'number' ? quotas.maxDiskQuota : 0;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 0;
  const limitLabel = limit ? formatSize(limit) : t('list.unlimitedQuota', '∞');

  if (used >= 0) {
    return `${formatSize(used)} / ${limitLabel}`;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <SizeDisplay bytes={used} />
      <span className="text-muted-foreground">/</span>
      <span>{limitLabel}</span>
    </span>
  );
}

function getFieldsRecord(resolvedSchema: ResolvedSchema): Record<string, Field> {
  if (resolvedSchema.type === 'single') {
    return resolvedSchema.fields.properties;
  }
  const merged: Record<string, Field> = {};
  for (const variant of resolvedSchema.variants) {
    if (variant.fields) {
      Object.assign(merged, variant.fields.properties);
    }
  }
  return merged;
}

function renderCellValue(
  value: unknown,
  field: Field | undefined,
  colName: string,
  schema: Schema,
  objectName: string,
  getDisplayName: (objectType: string, id: string) => string | undefined,
): React.ReactNode {
  if (value == null) return <span className="text-muted-foreground">-</span>;

  if (colName === '@type' && typeof value === 'string') {
    const objSchema = schema.schemas[objectName];
    if (objSchema?.type === 'multiple') {
      const variant = objSchema.variants.find((v) => v.name === value);
      if (variant) {
        return <Badge variant="secondary">{variant.label}</Badge>;
      }
    }
    return String(value);
  }

  if (!field) return String(value);

  const ft = field.type;

  switch (ft.type) {
    case 'string':
      if ((ft.format === 'text' || ft.format === 'html') && value) {
        const str = String(value);
        if (str) {
          return (
            <pre className="whitespace-pre-wrap break-words text-xs font-mono bg-muted/50 rounded px-1.5 py-1 max-w-md">
              {str}
            </pre>
          );
        }
      }
      return String(value);

    case 'number': {
      switch (ft.format) {
        case 'size':
          return formatSize(value);
        case 'duration':
          return formatDuration(value);
        default:
          return formatNumber(value);
      }
    }

    case 'utcDateTime': {
      if (typeof value === 'string' || typeof value === 'number') {
        try {
          return new Date(value).toLocaleString();
        } catch {
          return String(value);
        }
      }
      return String(value);
    }

    case 'boolean':
      return value ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-red-500" />;

    case 'enum': {
      const variants = schema.enums[ft.enumName];
      const variant = variants?.find((v) => v.name === value);
      if (variant) {
        return (
          <Badge
            variant="secondary"
            className={variant.color ? undefined : undefined}
            style={variant.color ? { backgroundColor: variant.color, color: '#fff' } : undefined}
          >
            {variant.label}
          </Badge>
        );
      }
      return String(value);
    }

    case 'objectId': {
      const id = String(value);
      const display = getDisplayName(ft.objectName, id);
      return display ?? id;
    }

    case 'set': {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const keys = Object.keys(value as Record<string, boolean>);
        if (ft.class.type === 'enum' && ft.class.enumName) {
          const variants = schema.enums[ft.class.enumName];
          if (variants) {
            const labels = keys.map((k) => {
              const variant = variants.find((v) => v.name === k);
              return variant?.label ?? k;
            });
            return labels.join(', ');
          }
        }
        return keys.join(', ');
      }
      return <span className="text-muted-foreground">-</span>;
    }

    case 'object': {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const obj = value as Record<string, unknown>;
        if ('@type' in obj && typeof obj['@type'] === 'string') {
          const variantSchema = schema.schemas[ft.objectName];
          if (variantSchema?.type === 'multiple') {
            const variant = variantSchema.variants.find((v) => v.name === obj['@type']);
            if (variant) {
              return <Badge variant="secondary">{variant.label}</Badge>;
            }
          }
          return String(obj['@type']);
        }
      }
      return <span className="text-muted-foreground">-</span>;
    }

    default:
      if (value && typeof value === 'object') {
        return <span className="text-muted-foreground">-</span>;
      }
      return String(value);
  }
}

interface SortState {
  field: string;
  ascending: boolean;
}

function readUrlFilters(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const filters: Record<string, string> = {};
  params.forEach((value, key) => {
    if (key.startsWith('f.')) {
      filters[key.slice(2)] = value;
    }
  });
  return filters;
}

function readUrlSort(): SortState | null {
  const params = new URLSearchParams(window.location.search);
  const sortParam = params.get('sort');
  const sortDir = params.get('sortDir');
  return sortParam ? { field: sortParam, ascending: sortDir !== 'desc' } : null;
}

interface ConfirmAction {
  label: string;
  onConfirm: () => void;
}


function isActiveWebApplication(item: Record<string, unknown>): boolean {
  const prefixes = item.urlPrefix;
  const values: string[] = [];
  if (Array.isArray(prefixes)) {
    values.push(...prefixes.map(String));
  } else if (typeof prefixes === 'string') {
    values.push(...prefixes.split(',').map((s) => s.trim()));
  } else if (prefixes && typeof prefixes === 'object') {
    // JMAP exposes urlPrefix as a set object such as { "/admin": true, "/account": true }
    for (const [key, value] of Object.entries(prefixes)) {
      if (value === true) {
        values.push(key);
      }
    }
  } else if (prefixes != null) {
    values.push(String(prefixes));
  }
  return values.some((p) => p === '/admin' || p === '/account');
}
interface DynamicListProps {
  viewName: string;
}

export function DynamicList({ viewName }: DynamicListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  const schema = useSchemaStore((s) => s.schema);
  const viewToSection = useSchemaStore((s) => s.viewToSection);
  const hasObjectPermission = useAccountStore((s) => s.hasObjectPermission);
  const edition = useAccountStore((s) => s.edition);
  // Reactive, unlike the getAccountId() snapshot read inside fetchData: needed
  // so switching accounts from the profile dropdown (a pure store update with
  // no navigation) re-triggers the fetch effect below for account-scoped
  // views (Mailboxes, Calendars, Sieve Scripts, ...) even when viewName
  // itself doesn't change.
  const activeAccountId = useAuthStore((s) => s.activeAccountId);
  const [upsellOpen, setUpsellOpen] = useState(false);

  const resolved = useMemo(() => {
    if (!schema) return null;
    const obj = resolveObject(schema, viewName);
    if (!obj) return null;
    const schem = resolveSchema(schema, obj.objectName);
    if (!schem) return null;
    const list = resolveList(schema, viewName, obj.objectName);
    return { obj, schema: schem, list };
  }, [schema, viewName]);

  const objectName = resolved?.obj.objectName;
  const isWebApplications = viewName === 'x:Application' || objectName === 'x:Application';
  const isLogEntries = viewName === 'x:Log' || objectName === 'x:Log';
  const isAccountsList = viewName === 'x:Account/User';
  const isMailboxList = viewName === 'Mailbox';
  // Not tied to a specific viewName: any list whose schema-driven columns
  // (see withAccountListColumns, account-quota-usage-column deviation)
  // include the synthetic `quotaUsage` column gets it resolved and rendered.
  const hasQuotaUsageColumn = (resolved?.list?.columns ?? []).some((c) => c.name === 'quotaUsage');

  const displayColumns = useMemo(() => {
    const columns = resolved?.list?.columns ?? [];
    if (!isWebApplications) return columns;

    // For Web Applications, present Description first and Enabled second
    // to match the layout of other tables such as Domains. Reordering real
    // schema columns is fine, but the synthetic fallback below (when the
    // schema doesn't list an Enabled column at all) is a tracked deviation.
    // SCHEMA-DEVIATION: webapp-enabled-column-fallback (see SCHEMA_DEVIATIONS.md)
    const ordered = ['description', 'enabled'];
    const rest = columns.filter((c) => !ordered.includes(c.name));
    const descriptionCol = columns.find((c) => c.name === 'description');
    const enabledCol = columns.find((c) => c.name === 'enabled');

    const result: Array<{ name: string; label: string }> = [];
    if (descriptionCol) result.push(descriptionCol);
    if (enabledCol) {
      result.push(enabledCol);
    } else {
      result.push({ name: 'enabled', label: t('webApplications.enabled', 'Enabled') });
    }
    result.push(...rest);
    return result;
  }, [resolved?.list?.columns, isWebApplications]);

  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayNames = useCacheStore((s) => s.displayNames);
  const setDisplayNames = useCacheStore((s) => s.setDisplayNames);
  const getDisplayName = useCallback(
    (objectType: string, id: string): string | undefined => displayNames[objectType]?.[id],
    [displayNames],
  );

  const [anchorStack, setAnchorStack] = useState<string[]>([]);
  const [currentAnchor, setCurrentAnchor] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllMode, setSelectAllMode] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(() => Object.keys(readUrlFilters()).length > 0);
  const [filterValues, setFilterValues] = useState<Record<string, string>>(readUrlFilters);
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>(readUrlFilters);

  const [sort, setSort] = useState<SortState | null>(readUrlSort);

  // Filters marked `clientOnly` (currently Level/Event on the Logs list) are
  // not supported by the server's query engine, so they narrow an
  // already-fetched result set in the browser instead of being sent as a
  // JMAP filter. That switches pagination to a client-held array.
  const clientFilterDefs = useMemo(
    () => (resolved?.list?.filters ?? []).filter(isClientOnlyFilter),
    [resolved?.list?.filters],
  );
  const activeClientFilters = useMemo(
    () =>
      clientFilterDefs
        .map((f) => ({ field: f.field, value: appliedFilters[f.field] ?? '' }))
        .filter((f) => f.value !== ''),
    [clientFilterDefs, appliedFilters],
  );
  const [clientAllItems, setClientAllItems] = useState<Record<string, unknown>[] | null>(null);
  const [clientPage, setClientPage] = useState(0);
  const [mailboxDepths, setMailboxDepths] = useState<Map<string, number>>(new Map());

  const [refreshOnCooldown, setRefreshOnCooldown] = useState(false);
  const refreshCooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (refreshCooldownTimer.current) clearTimeout(refreshCooldownTimer.current);
    };
  }, []);

  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [activeWebApp, setActiveWebApp] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!isWebApplications || !schema) return;
    let cancelled = false;

    void (async () => {
      try {
        const accountId = getAccountId(objectName ?? 'x:Application');
        const result = await jmapQueryAllAndGet(
          objectName ?? 'x:Application',
          accountId,
          {},
          ['id', 'description', 'enabled', 'urlPrefix', 'resourceUrl'],
        );
        if (cancelled) return;
        const active = result.list.find((item) => isActiveWebApplication(item));
        setActiveWebApp(active ?? null);
      } catch (err) {
        console.error('Failed to fetch active web application:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isWebApplications, schema]);

  useResetOnChange(viewName, () => {
    setItems([]);
    setTotal(null);
    setAnchorStack([]);
    setCurrentAnchor(null);
    setSelectedIds(new Set());
    setSelectAllMode(false);
    setError(null);
    setClientAllItems(null);
    setClientPage(0);
    setMailboxDepths(new Map());
    if (refreshCooldownTimer.current) clearTimeout(refreshCooldownTimer.current);
    setRefreshOnCooldown(false);

    const initialFilters = readUrlFilters();
    setFilterValues(initialFilters);
    setAppliedFilters(initialFilters);
    setFiltersOpen(Object.keys(initialFilters).length > 0);
    setSort(readUrlSort());
  });

  const buildFilter = useCallback((): Record<string, unknown> => {
    const clientFields = new Set(clientFilterDefs.map((f) => f.field));
    const serverAppliedFilters: Record<string, string> = {};
    for (const [key, val] of Object.entries(appliedFilters)) {
      const baseKey = key.endsWith('Op') ? key.slice(0, -2) : key;
      if (clientFields.has(baseKey)) continue;
      serverAppliedFilters[key] = val;
    }
    return buildJmapFilter({
      appliedFilters: serverAppliedFilters,
      filters: resolved?.list?.filters,
      filtersStatic: resolved?.list?.filtersStatic,
      isXPrefixed: objectName?.startsWith('x:') ?? false,
    });
  }, [appliedFilters, resolved?.list, objectName, clientFilterDefs]);

  const buildSort = useCallback((): Record<string, unknown>[] | undefined => {
    if (!sort) return undefined;
    return [{ property: sort.field, isAscending: sort.ascending }];
  }, [sort]);

  const fetchData = useCallback(
    async (anchor: string | null, anchorOffset: number = 1) => {
      if (!resolved || !resolved.list || !schema) return;

      const { obj, list } = resolved;
      setLoading(true);
      setError(null);

      try {
        const accountId = getAccountId(obj.objectName);
        const properties = ['id', ...list.columns.map((c) => c.name)];
        if (isWebApplications && !properties.includes('enabled')) {
          properties.push('enabled');
        }
        if (hasQuotaUsageColumn) {
          const quotaIdx = properties.indexOf('quotaUsage');
          if (quotaIdx !== -1) {
            properties.splice(quotaIdx, 1, 'usedDiskQuota', 'quotas');
          }
        }
        if (isMailboxList && !properties.includes('parentId')) {
          properties.push('parentId');
        }
        const filter = buildFilter();
        const sortArr = buildSort();

        if (activeClientFilters.length > 0 || isMailboxList) {
          // No server-side pagination possible once a client-only filter is
          // active (SCHEMA-DEVIATION: log-client-filters): fetch every
          // server-matching row up front, narrow it in the browser, then
          // paginate the in-memory result locally. Mailbox hierarchy needs
          // this too (SCHEMA-DEVIATION: mailbox-client-hierarchy-sort) — a
          // mailbox's parent can land on a different server page than the
          // mailbox itself, so the full set is required to place each row
          // under its parent correctly.
          const { list: fullList } = await jmapQueryAllAndGet(
            obj.objectName,
            accountId,
            { filter: Object.keys(filter).length > 0 ? filter : undefined, sort: sortArr },
            properties,
          );
          let matched = fullList.filter((item) =>
            activeClientFilters.every((f) => String(item[f.field] ?? '') === f.value),
          );
          if (isMailboxList) {
            const { items: ordered, depths } = sortMailboxesByHierarchy(matched);
            matched = ordered;
            setMailboxDepths(depths);
          }
          setClientAllItems(matched);
          setClientPage(0);
          setTotal(matched.length);
          setItems(matched.slice(0, PAGE_SIZE));
          setSelectedIds(new Set());
          return;
        }
        setClientAllItems(null);

        const queryOptions: Record<string, unknown> = {
          filter: Object.keys(filter).length > 0 ? filter : undefined,
          sort: sortArr,
          limit: PAGE_SIZE,
        };

        if (anchor === null) {
          queryOptions.position = 0;
          queryOptions.calculateTotal = true;
        } else {
          queryOptions.anchor = anchor;
          queryOptions.anchorOffset = anchorOffset;
        }

        const responses = await jmapQueryAndGet(obj.objectName, accountId, queryOptions, properties);

        const queryResp = responses[0];
        const getResp = responses[1];

        if (queryResp[0].includes('/error') || getResp[0].includes('/error')) {
          const errData = queryResp[0].includes('/error') ? queryResp[1] : getResp[1];
          setError(String((errData as Record<string, unknown>).type ?? t('list.unknownError', 'Unknown error')));
          return;
        }

        const queryData = queryResp[1] as {
          ids: string[];
          total?: number;
          position?: number;
        };
        const getData = getResp[1] as {
          list: Record<string, unknown>[];
        };

        if (queryData.total != null) {
          setTotal(queryData.total);
        }

        setItems(getData.list ?? []);
        setSelectedIds(new Set());
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [resolved, schema, buildFilter, buildSort, isWebApplications, isAccountsList, hasQuotaUsageColumn, isMailboxList, activeClientFilters],
  );

  useEffect(() => {
    if (!resolved?.list) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnchorStack([]);
    setCurrentAnchor(null);
    fetchData(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewName, sort, resolved?.list, appliedFilters, activeAccountId]);

  useEffect(() => {
    if (!schema || !resolved?.list || items.length === 0) return;

    const fieldMap = getFieldsRecord(resolved.schema);

    const missingByType = new Map<string, Set<string>>();
    for (const col of resolved.list.columns) {
      const field = fieldMap[col.name];
      if (field?.type.type !== 'objectId') continue;
      const refType = field.type.objectName;
      for (const item of items) {
        const value = item[col.name];
        if (typeof value !== 'string' || !value) continue;
        if (displayNames[refType]?.[value] !== undefined) continue;
        let set = missingByType.get(refType);
        if (!set) {
          set = new Set();
          missingByType.set(refType, set);
        }
        set.add(value);
      }
    }
    if (missingByType.size === 0) return;

    let cancelled = false;
    (async () => {
      for (const [refType, idSet] of missingByType) {
        try {
          const accountId = getAccountId(refType);
          const displayProp = getDisplayProperty(schema, refType);
          const ids = Array.from(idSet);
          const list = await jmapGetBatched(refType, accountId, ids, ['id', displayProp]);
          if (cancelled) return;
          const entries: Record<string, string> = {};
          for (const obj of list) {
            const id = obj.id as string;
            if (!id) continue;
            entries[id] = coerceLabel(obj[displayProp], id);
          }
          if (Object.keys(entries).length > 0) {
            setDisplayNames(refType, entries);
          }
        } catch (err) {
          console.error('Failed to resolve display names for', refType, err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, resolved, schema, setDisplayNames]);

  const applyFilters = useCallback(() => {
    setAppliedFilters({ ...filterValues });
  }, [filterValues]);

  const resetFilters = useCallback(() => {
    setFilterValues({});
    setAppliedFilters({});
  }, []);

  const handleRefresh = useCallback(() => {
    if (refreshOnCooldown) return;
    setRefreshOnCooldown(true);
    fetchData(currentAnchor, 0);
    refreshCooldownTimer.current = setTimeout(() => setRefreshOnCooldown(false), REFRESH_COOLDOWN_MS);
  }, [refreshOnCooldown, fetchData, currentAnchor]);

  useEffect(() => {
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(appliedFilters)) {
      if (val !== '' && val != null) {
        params.set(`f.${key}`, val);
      }
    }
    if (sort) {
      params.set('sort', sort.field);
      params.set('sortDir', sort.ascending ? 'asc' : 'desc');
    }
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterValues, sort]);

  const handleNextPage = useCallback(() => {
    if (clientAllItems !== null) {
      const nextPage = clientPage + 1;
      setClientPage(nextPage);
      setItems(clientAllItems.slice(nextPage * PAGE_SIZE, nextPage * PAGE_SIZE + PAGE_SIZE));
      return;
    }

    if (items.length === 0) return;
    const lastItem = items[items.length - 1];
    const lastId = lastItem?.id as string;
    if (!lastId) return;

    const firstId = (items[0]?.id as string) ?? null;
    if (firstId) {
      setAnchorStack((prev) => [...prev, firstId]);
    }
    setCurrentAnchor(lastId);
    fetchData(lastId, 1);
  }, [items, fetchData, clientAllItems, clientPage]);

  const handlePrevPage = useCallback(() => {
    if (clientAllItems !== null) {
      const prevPage = Math.max(0, clientPage - 1);
      setClientPage(prevPage);
      setItems(clientAllItems.slice(prevPage * PAGE_SIZE, prevPage * PAGE_SIZE + PAGE_SIZE));
      return;
    }

    if (anchorStack.length === 0) {
      return;
    }

    const newStack = [...anchorStack];
    const prevFirstId = newStack.pop()!;
    setAnchorStack(newStack);

    if (newStack.length === 0) {
      setCurrentAnchor(null);
      fetchData(null);
    } else {
      setCurrentAnchor(prevFirstId);
      fetchData(prevFirstId, 0);
    }
  }, [anchorStack, fetchData, clientAllItems, clientPage]);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
      setSelectAllMode(false);
    } else {
      setSelectedIds(new Set(items.map((item) => item.id as string)));
      setSelectAllMode(false);
    }
  }, [items, selectedIds]);

  const toggleSelectItem = useCallback((id: string) => {
    setSelectAllMode(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSort = useCallback((field: string) => {
    setSort((prev) => {
      if (prev?.field === field) {
        return { field, ascending: !prev.ascending };
      }
      return { field, ascending: true };
    });
  }, []);

  const handleFilterChange = useCallback((field: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleFilterSelectChange = useCallback((field: string, value: string) => {
    const actualValue = value === '__all__' ? '' : value;
    setFilterValues((prev) => ({ ...prev, [field]: actualValue }));
  }, []);

  const handleFilterKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyFilters();
      }
    },
    [applyFilters],
  );

  const executeMassAction = useCallback(
    async (action: MassAction) => {
      if (!resolved || selectedIds.size === 0) return;
      const { obj } = resolved;

      try {
        setLoading(true);
        const accountId = getAccountId(obj.objectName);

        let targetIds: string[];
        if (selectAllMode) {
          if (clientAllItems !== null) {
            // A client-only filter is active: the full server-matching set
            // would include rows it excludes, so use the already-narrowed list.
            targetIds = clientAllItems.map((item) => item.id as string);
          } else {
            const filter = buildFilter();
            const sortArr = buildSort();
            targetIds = await jmapQueryAll(obj.objectName, accountId, {
              filter: Object.keys(filter).length > 0 ? filter : undefined,
              sort: sortArr,
            });
          }
        } else {
          targetIds = Array.from(selectedIds);
        }

        const batchSize = useAuthStore.getState().maxObjectsInSet;

        let totalSuccess = 0;
        const allErrors: Record<string, JmapSetError> = {};

        if (action.type === 'delete') {
          for (let i = 0; i < targetIds.length; i += batchSize) {
            const batch = targetIds.slice(i, i + batchSize);
            const raw = await jmapSet(obj.objectName, accountId, { destroy: batch });
            const resp = parseSetResponse(raw);
            if (resp) {
              totalSuccess += resp.destroyed?.length ?? 0;
              if (resp.notDestroyed) Object.assign(allErrors, resp.notDestroyed);
            }
          }
        } else if (action.type === 'setProperty') {
          for (let i = 0; i < targetIds.length; i += batchSize) {
            const batch = targetIds.slice(i, i + batchSize);
            const update: Record<string, Record<string, unknown>> = {};
            for (const id of batch) {
              update[id] = action.properties;
            }
            const raw = await jmapSet(obj.objectName, accountId, { update });
            const resp = parseSetResponse(raw);
            if (resp) {
              totalSuccess += resp.updated ? Object.keys(resp.updated).length : 0;
              if (resp.notUpdated) Object.assign(allErrors, resp.notUpdated);
            }
          }
        }

        const summary = bulkResultSummary(
          totalSuccess,
          Object.keys(allErrors).length > 0 ? allErrors : null,
          action.type === 'delete' ? 'delete' : 'update',
          t,
        );
        if (summary) {
          toast({ title: summary.title, description: summary.description, variant: summary.variant });
        }

        setSelectedIds(new Set());
        setSelectAllMode(false);
        fetchData(currentAnchor, 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [resolved, selectedIds, selectAllMode, buildFilter, buildSort, fetchData, currentAnchor, t, clientAllItems],
  );

  const executeItemAction = useCallback(
    async (action: ItemAction, item: Record<string, unknown>) => {
      if (!resolved) return;
      const { obj } = resolved;
      const itemId = item.id as string;

      switch (action.type) {
        case 'view': {
          const targetSection = viewToSection[action.objectName] ?? viewToSection[viewName];
          if (targetSection) {
            navigate(`/${targetSection}/${action.objectName}/${itemId}`);
          }
          break;
        }
        case 'query': {
          const targetSection = viewToSection[action.objectName] ?? viewToSection[viewName];
          if (targetSection) {
            const params = new URLSearchParams();
            params.set(`f.${action.fieldName}`, itemId);
            navigate(`/${targetSection}/${action.objectName}?${params.toString()}`);
          }
          break;
        }
        case 'setProperty': {
          try {
            setLoading(true);
            const accountId = getAccountId(obj.objectName);
            const raw = await jmapSet(obj.objectName, accountId, {
              update: { [itemId]: action.properties },
            });
            const resp = parseSetResponse(raw);
            if (resp?.notUpdated?.[itemId]) {
              setError(friendlySetError(resp.notUpdated[itemId]));
            } else {
              fetchData(currentAnchor, 0);
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setLoading(false);
          }
          break;
        }
        case 'delete': {
          try {
            setLoading(true);
            const accountId = getAccountId(obj.objectName);
            const raw = await jmapSet(obj.objectName, accountId, {
              destroy: [itemId],
            });
            const resp = parseSetResponse(raw);
            if (resp?.notDestroyed?.[itemId]) {
              setError(friendlySetError(resp.notDestroyed[itemId]));
            } else if (resp?.destroyed?.includes(itemId)) {
              fetchData(currentAnchor, 0);
            } else {
              setError(
                t('list.deleteNotConfirmed', 'Delete failed: item was not confirmed as destroyed by the server.'),
              );
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setLoading(false);
          }
          break;
        }
        case 'separator':
          break;
      }
    },
    [resolved, viewName, viewToSection, navigate, fetchData, currentAnchor, t],
  );

  const handleRowClick = useCallback(
    (item: Record<string, unknown>) => {
      const section = viewToSection[viewName];
      if (section && item.id) {
        navigate(`/${section}/${viewName}/${item.id}`);
      }
    },
    [viewName, viewToSection, navigate],
  );

  const canCreate = resolved ? hasObjectPermission(resolved.obj.permissionPrefix, 'Create') : false;
  const canUpdate = resolved ? hasObjectPermission(resolved.obj.permissionPrefix, 'Update') : false;
  const canDelete = resolved ? hasObjectPermission(resolved.obj.permissionPrefix, 'Destroy') : false;

  if (!schema) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!resolved) {
    return <div className="p-8 text-center text-muted-foreground">{t('errors.viewNotFound', 'View not found')}</div>;
  }

  if (!resolved.list) {
    return <div className="p-8 text-center text-muted-foreground">No list configured</div>;
  }

  const { obj, schema: resolvedSchema, list } = resolved;
  const fields = getFieldsRecord(resolvedSchema);
  const sortableFields = new Set(list.sort ?? []);
  const isXPrefixed = obj.objectName.startsWith('x:');

  const effectiveMassActions: MassAction[] = (() => {
    const schemaActions = list.massActions ?? [];
    const canDestroy = obj.objectType.type === 'object' && hasObjectPermission(obj.permissionPrefix, 'Destroy');
    if (!canDestroy) return schemaActions;

    const hasSchemaDelete = schemaActions.some((a) => a.type === 'delete');
    if (hasSchemaDelete) return schemaActions;

    return [...schemaActions, { type: 'delete', label: t('list.delete', 'Delete') } satisfies MassAction];
  })();

  const hasMassActions = effectiveMassActions.length > 0;
  const hasItemActions = (list.itemActions?.length ?? 0) > 0;

  const pageStart = clientAllItems !== null ? clientPage * PAGE_SIZE : anchorStack.length * PAGE_SIZE;
  const rangeStart = pageStart + 1;
  const rangeEnd = pageStart + items.length;
  const hasNextPage = clientAllItems !== null ? rangeEnd < clientAllItems.length : total !== null && rangeEnd < total;
  const hasPrevPage = clientAllItems !== null ? clientPage > 0 : anchorStack.length > 0;

  function renderFilter(filterDef: FilterDef): React.ReactNode {
    const value = filterValues[filterDef.field] ?? '';

    const wrapper = (content: React.ReactNode) => (
      <div key={filterDef.field} className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">{filterDef.label}</label>
        {content}
      </div>
    );

    switch (filterDef.type) {
      case 'text':
        return wrapper(
          <Input
            placeholder={t('list.filterPlaceholder', 'Search {{label}}...', { label: filterDef.label.toLowerCase() })}
            value={value}
            onChange={(e) => handleFilterChange(filterDef.field, e.target.value)}
            onKeyDown={handleFilterKeyDown}
          />,
        );

      case 'enum': {
        const enumVariants = schema!.enums[filterDef.enumName] ?? [];

        if (enumVariants.length > ENUM_COMBOBOX_THRESHOLD) {
          return wrapper(
            <Combobox
              options={enumVariants.map((v) => ({ value: v.name, label: v.label }))}
              value={value}
              onValueChange={(v) => handleFilterChange(filterDef.field, v)}
              placeholder={filterDef.label}
              searchPlaceholder={t('list.comboboxSearchPlaceholder', 'Search...')}
              emptyText={t('list.comboboxEmptyText', 'No matches.')}
              nullable
              nullLabel={t('filters.all', 'All')}
            />,
          );
        }

        return wrapper(
          <Select value={value || '__all__'} onValueChange={(v) => handleFilterSelectChange(filterDef.field, v)}>
            <SelectTrigger>
              <SelectValue placeholder={filterDef.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('filters.all', 'All')}</SelectItem>
              {enumVariants.map((v) => (
                <SelectItem key={v.name} value={v.name}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>,
        );
      }

      case 'integer': {
        if (!isXPrefixed) {
          return wrapper(
            <Input
              type="number"
              placeholder={filterDef.label}
              value={value}
              onChange={(e) => handleFilterChange(filterDef.field, e.target.value)}
              onKeyDown={handleFilterKeyDown}
            />,
          );
        }
        const opField = `${filterDef.field}Op`;
        const opValue = filterValues[opField] ?? 'eq';
        return wrapper(
          <div className="flex gap-2">
            <Select value={opValue} onValueChange={(v) => handleFilterSelectChange(opField, v)}>
              <SelectTrigger className="w-20 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eq">=</SelectItem>
                <SelectItem value="gt">&gt;</SelectItem>
                <SelectItem value="lt">&lt;</SelectItem>
                <SelectItem value="gte">&gt;=</SelectItem>
                <SelectItem value="lte">&lt;=</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder={filterDef.label}
              value={value}
              onChange={(e) => handleFilterChange(filterDef.field, e.target.value)}
              onKeyDown={handleFilterKeyDown}
              className="flex-1"
            />
          </div>,
        );
      }

      case 'date': {
        if (!isXPrefixed) {
          return wrapper(
            <Input
              type="date"
              value={value}
              onChange={(e) => handleFilterChange(filterDef.field, e.target.value)}
              onKeyDown={handleFilterKeyDown}
            />,
          );
        }
        const opField = `${filterDef.field}Op`;
        const opValue = filterValues[opField] ?? 'eq';
        return wrapper(
          <div className="flex gap-2">
            <Select value={opValue} onValueChange={(v) => handleFilterSelectChange(opField, v)}>
              <SelectTrigger className="w-24 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eq">=</SelectItem>
                <SelectItem value="gt">{t('filters.after', 'After')}</SelectItem>
                <SelectItem value="lt">{t('filters.before', 'Before')}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={value}
              onChange={(e) => handleFilterChange(filterDef.field, e.target.value)}
              onKeyDown={handleFilterKeyDown}
              className="flex-1"
            />
          </div>,
        );
      }

      case 'objectId':
        return wrapper(
          <ObjectPicker
            schema={schema!}
            objectName={filterDef.objectName}
            value={value}
            onChange={(id) => {
              setFilterValues((prev) => ({ ...prev, [filterDef.field]: id }));
              setAppliedFilters((prev) => ({ ...prev, [filterDef.field]: id }));
            }}
            onClear={() => {
              setFilterValues((prev) => {
                const next = { ...prev };
                delete next[filterDef.field];
                return next;
              });
              setAppliedFilters((prev) => {
                const next = { ...prev };
                delete next[filterDef.field];
                return next;
              });
            }}
            placeholder={t('list.selectFilterPlaceholder', 'Select {{label}}...', {
              label: filterDef.label.toLowerCase(),
            })}
          />,
        );

      default:
        return null;
    }
  }

  function renderSortIndicator(colName: string): React.ReactNode {
    if (!sortableFields.has(colName)) return null;
    const isActive = sort?.field === colName;
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleSort(colName);
        }}
        className="ml-1 inline-flex items-center"
        title={t('list.sort', 'Sort')}
      >
        {isActive ? (
          sort.ascending ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
    );
  }

  function renderItemActions(item: Record<string, unknown>): React.ReactNode {
    if (!hasItemActions || !list.itemActions) return null;

    const filteredActions = list.itemActions.flatMap((action): { action: ItemAction; locked: boolean }[] => {
      if (action.type === 'separator') return [{ action, locked: false }];
      if (action.type === 'delete') return canDelete ? [{ action, locked: false }] : [];
      if (action.type === 'setProperty') return canUpdate ? [{ action, locked: false }] : [];
      if (action.type === 'view' || action.type === 'query') {
        const targetObj = resolveObject(schema!, action.objectName);
        if (!targetObj) return [];
        if (targetObj.enterprise) {
          if (edition === 'oss') return [];
          if (edition === 'community') return [{ action, locked: true }];
        }
        if (!hasObjectPermission(targetObj.permissionPrefix, 'Get')) return [];
      }
      return [{ action, locked: false }];
    });

    if (filteredActions.length === 0) return null;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {filteredActions.map(({ action, locked }, idx) => {
            if (action.type === 'separator') {
              return <DropdownMenuSeparator key={`sep-${idx}`} />;
            }

            const isDestructive = action.type === 'delete';
            const needsConfirmation = action.type === 'delete' || action.type === 'setProperty';

            return (
              <DropdownMenuItem
                key={`${action.type}-${idx}`}
                className={isDestructive ? 'text-destructive' : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  if (locked) {
                    setUpsellOpen(true);
                  } else if (needsConfirmation) {
                    setConfirmAction({
                      label: action.label,
                      onConfirm: () => executeItemAction(action, item),
                    });
                  } else {
                    executeItemAction(action, item);
                  }
                }}
              >
                {action.label}
                {locked && <Lock className="ml-auto h-3 w-3 text-muted-foreground" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="relative min-w-0 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight truncate">{list.title}</h1>
          {list.subtitle && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{list.subtitle}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {hasMassActions && selectedIds.size > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {t('list.massAction', 'Actions')} ({selectAllMode ? (total ?? selectedIds.size) : selectedIds.size})
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {effectiveMassActions.map((action, idx) => {
                  if (action.type === 'separator') {
                    return <DropdownMenuSeparator key={`mass-sep-${idx}`} />;
                  }

                  const isDestructive = action.type === 'delete';
                  if (isDestructive && !canDelete) return null;
                  if (action.type === 'setProperty' && !canUpdate) return null;

                  const actionCount = selectAllMode ? (total ?? selectedIds.size) : selectedIds.size;
                  return (
                    <DropdownMenuItem
                      key={`mass-${idx}`}
                      className={isDestructive ? 'text-destructive' : undefined}
                      onClick={() => {
                        setConfirmAction({
                          label: t('list.actionWithCount', '{{action}} ({{count}} {{name}})', {
                            action: action.label,
                            count: actionCount,
                            name: actionCount === 1 ? list.singularName : list.pluralName,
                          }),
                          onConfirm: () => executeMassAction(action),
                        });
                      }}
                    >
                      {action.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {canCreate && obj.objectType.type === 'object' && (
            <Button
              onClick={() => {
                const section = viewToSection[viewName];
                if (section) {
                  navigate(`/${section}/${viewName}/new`);
                }
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('list.create', 'Create {{name}}', { name: list.singularName })}
            </Button>
          )}
        </div>
      </div>

      {list.filters && list.filters.length > 0 && (
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                {t('list.filters', 'Filters')}
                {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            {isLogEntries && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleRefresh}
                disabled={refreshOnCooldown || loading}
                title={
                  refreshOnCooldown
                    ? t('list.refreshCooldown', 'Please wait a few seconds before refreshing again')
                    : undefined
                }
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {t('list.refresh', 'Refresh')}
              </Button>
            )}
          </div>
          <CollapsibleContent>
            <div className="mt-2 rounded-lg border bg-background shadow-sm">
              <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
                {list.filters.map((filterDef) => renderFilter(filterDef))}
              </div>
              <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
                <Button type="button" variant="ghost" size="sm" onClick={resetFilters} disabled={loading}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t('list.resetFilters', 'Reset')}
                </Button>
                <Button type="button" size="sm" onClick={applyFilters} disabled={loading}>
                  <Search className="mr-2 h-4 w-4" />
                  {t('list.searchFilters', 'Search')}
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {hasMassActions &&
        selectedIds.size === items.length &&
        items.length > 0 &&
        total !== null &&
        total > items.length &&
        !selectAllMode && (
          <div className="rounded-md border bg-muted/50 px-4 py-2 text-sm text-center">
            {t('list.allPageSelected', 'All {{count}} items on this page are selected.', { count: items.length })}{' '}
            <button className="text-primary underline hover:text-primary/80" onClick={() => setSelectAllMode(true)}>
              {t('list.selectAllMatching', 'Select all {{total}} items matching filters', { total })}
            </button>
          </div>
        )}
      {selectAllMode && (
        <div className="rounded-md border border-primary/50 bg-primary/10 px-4 py-2 text-sm text-center">
          {t('list.allItemsSelected', 'All {{total}} items matching filters are selected.', { total: total ?? 0 })}{' '}
          <button
            className="text-primary underline hover:text-primary/80"
            onClick={() => {
              setSelectAllMode(false);
              setSelectedIds(new Set());
            }}
          >
            {t('list.clearSelection', 'Clear selection')}
          </button>
        </div>
      )}

      {isWebApplications && activeWebApp && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {t('webApplications.activeWebUI', 'Active WebUI')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <p className="text-sm text-muted-foreground">
              {String(activeWebApp.description ?? '-')}
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t('webApplications.version', 'Version')}:</span>
              <Badge variant="secondary">{__APP_VERSION__}</Badge>
            </div>
            {typeof activeWebApp.resourceUrl === 'string' && activeWebApp.resourceUrl && (
              <div className="flex items-start gap-2 text-sm">
                <span className="shrink-0 text-muted-foreground">{t('webApplications.resourceUrl', 'Source')}:</span>
                <a
                  href={activeWebApp.resourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-primary hover:underline"
                >
                  {activeWebApp.resourceUrl}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="min-w-0 rounded-lg border bg-background shadow-sm">
        {/* The scroll container must clip with the parent's inner radius
            (outer radius minus the 1px border), otherwise filled header rows
            paint square corners behind the rounded border.
            `w-max min-w-full` keeps the table at least as wide as the card,
            but lets wide column sets scroll horizontally inside this wrapper. */}
        <div className="overflow-x-auto overscroll-x-contain rounded-[calc(var(--radius-lg)-1px)] [-webkit-overflow-scrolling:touch]">
          <table className="w-max min-w-full text-sm">
            <thead>
              <tr className="border-b bg-muted">
                {hasMassActions && (
                  <th className="w-10 px-3 py-3 whitespace-nowrap">
                    <Checkbox
                      checked={items.length > 0 && selectedIds.size === items.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label={t('list.selectAll', 'Select all')}
                    />
                  </th>
                )}
                {displayColumns.map((col) => (
                  <th
                    key={col.name}
                    className="px-3 py-3 text-left font-medium text-muted-foreground whitespace-nowrap"
                  >
                    <div className="flex items-center">
                      {col.label}
                      {renderSortIndicator(col.name)}
                    </div>
                  </th>
                ))}
                {hasItemActions && (
                  <th className="w-12 px-3 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">
                    {t('list.actions', 'Actions')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr>
                  <td
                    colSpan={displayColumns.length + (hasMassActions ? 1 : 0) + (hasItemActions ? 1 : 0)}
                    className="px-3 py-12 text-center"
                  >
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={displayColumns.length + (hasMassActions ? 1 : 0) + (hasItemActions ? 1 : 0)}
                    className="px-3 py-12 text-center text-muted-foreground"
                  >
                    {t('list.noResults', 'No results found')}
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const itemId = item.id as string;
                  return (
                    <tr
                      key={itemId}
                      className="border-b cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => handleRowClick(item)}
                    >
                      {hasMassActions && (
                        <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(itemId)}
                            onCheckedChange={() => toggleSelectItem(itemId)}
                            aria-label={t('list.selectItem', 'Select item')}
                          />
                        </td>
                      )}
                      {displayColumns.map((col) => (
                        <td key={col.name} className="px-3 py-2 whitespace-nowrap">
                          {isWebApplications && col.name === 'enabled' && !fields[col.name] ? (
                            item.enabled === true ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <X className="h-4 w-4 text-red-500" />
                            )
                          ) : isAccountsList && col.name === 'roles' ? (
                            formatUserRole(item, schema!)
                          ) : hasQuotaUsageColumn && col.name === 'quotaUsage' ? (
                            renderQuotaUsage(item, t)
                          ) : isMailboxList && col.name === 'name' ? (
                            (() => {
                              const depth = mailboxDepths.get(item.id as string) ?? 0;
                              return (
                                <div style={{ paddingLeft: depth * 20 }} className="flex items-center gap-1.5">
                                  {depth > 0 && (
                                    <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  )}
                                  <span>{String(item.name ?? '')}</span>
                                </div>
                              );
                            })()
                          ) : (
                            renderCellValue(
                              item[col.name],
                              fields[col.name],
                              col.name,
                              schema!,
                              resolved.obj.objectName,
                              getDisplayName,
                            )
                          )}
                        </td>
                      ))}
                      {hasItemActions && (
                        <td className="px-3 py-2 text-right whitespace-nowrap">{renderItemActions(item)}</td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {items.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
          <div className="min-w-0">
            {total !== null
              ? t('list.showing', 'Showing {{from}}-{{to}} of {{total}} {{name}}', {
                  from: rangeStart,
                  to: rangeEnd,
                  total,
                  name: list.pluralName,
                })
              : t('list.showingItems', 'Showing {{count}} items', {
                  count: items.length,
                })}
          </div>
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
            <Button variant="outline" size="sm" disabled={!hasPrevPage || loading} onClick={handlePrevPage}>
              {t('list.previous', 'Previous')}
            </Button>
            <Button variant="outline" size="sm" disabled={!hasNextPage || loading} onClick={handleNextPage}>
              {t('list.next', 'Next')}
            </Button>
          </div>
        </div>
      )}

      {loading && items.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('list.confirmTitle', 'Confirm Action')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('list.confirmDescription', 'Are you sure you want to proceed with: {{action}}?', {
                action: confirmAction?.label ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmAction?.onConfirm();
                setConfirmAction(null);
              }}
            >
              {t('common.confirm', 'Confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EnterpriseUpsell open={upsellOpen} onClose={() => setUpsellOpen(false)} />
    </div>
  );
}
