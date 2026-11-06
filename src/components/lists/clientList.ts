import { isClientOnlyFilterEnum, isClientSortableColumn } from '@/lib/schemaDeviationTypes';
import { listNeedsReportProperty, reportHasProblems } from '@/lib/reportSummaries';
import { getClientSortValue } from '@/lib/syntheticColumns';
import type { List } from '@/types/schema';
import type { ListItem } from './listQuery';
import type { ListUrlState } from './listUrlState';

/** Filter-state key (kept in the list URL) for the reports "Problems only" toggle. */
export const PROBLEMS_ONLY_KEY = 'problemsOnly';

type ClientList = Pick<List, 'filters' | 'columns' | 'sort'>;

export interface ClientPlan {
  /** True when rows must be fetched in full and filtered/sorted/paginated in the browser. */
  client: boolean;
  /** Client-only filters currently applied (field = value). */
  filters: Array<{ field: string; value: string }>;
  problemsOnly: boolean;
  /** Sort handled in the browser (null when the server sorts or nothing is sorted). */
  clientSort: { field: string; ascending: boolean } | null;
  hierarchy: boolean;
}

export function isClientSortField(list: Pick<List, 'columns'>, field: string): boolean {
  return list.columns.some((c) => c.name === field && isClientSortableColumn(c));
}

/**
 * SCHEMA-DEVIATION: log-client-filters, account-client-sort,
 * mailbox-client-hierarchy-sort, report-problems-only-filter
 *
 * Decides whether the list must switch to fetch-all mode: a client-only
 * filter is active, a client-sortable column is sorted, the mailbox tree is
 * shown (a parent may sit on another server page), or reports are narrowed
 * to problems (needs the nested `report` property).
 */
export function planClientMode(list: ClientList, objectName: string, state: ListUrlState): ClientPlan {
  const filters = (list.filters ?? [])
    .filter(isClientOnlyFilterEnum)
    .flatMap((f) => (state.filters[f.field] ? [{ field: f.field, value: state.filters[f.field] }] : []));
  const problemsOnly = state.filters[PROBLEMS_ONLY_KEY] === '1' && listNeedsReportProperty(list.columns);
  const clientSort = state.sort && isClientSortField(list, state.sort.field) ? state.sort : null;
  const hierarchy = objectName === 'Mailbox';
  return {
    client: filters.length > 0 || problemsOnly || clientSort !== null || hierarchy,
    filters,
    problemsOnly,
    clientSort,
    hierarchy,
  };
}

/**
 * SCHEMA-DEVIATION: mailbox-client-hierarchy-sort
 *
 * Orders mailboxes so each parent is immediately followed by its
 * descendants (siblings alphabetical) and records each row's depth.
 */
export function sortMailboxesByHierarchy(items: ListItem[]): { items: ListItem[]; depths: Map<string, number> } {
  const ids = new Set(items.map((item) => item.id as string));
  const childrenOf = new Map<string, ListItem[]>();
  const roots: ListItem[] = [];

  for (const item of items) {
    const parentId = item.parentId as string | null | undefined;
    if (parentId && ids.has(parentId)) {
      const siblings = childrenOf.get(parentId) ?? [];
      siblings.push(item);
      childrenOf.set(parentId, siblings);
    } else {
      roots.push(item);
    }
  }

  const byName = (a: ListItem, b: ListItem) => String(a.name ?? '').localeCompare(String(b.name ?? ''));
  roots.sort(byName);
  for (const siblings of childrenOf.values()) siblings.sort(byName);

  const ordered: ListItem[] = [];
  const depths = new Map<string, number>();
  const visit = (item: ListItem, depth: number) => {
    ordered.push(item);
    depths.set(item.id as string, depth);
    for (const child of childrenOf.get(item.id as string) ?? []) visit(child, depth + 1);
  };
  for (const root of roots) visit(root, 0);

  return { items: ordered, depths };
}

export interface ProcessedRows {
  items: ListItem[];
  depths: Map<string, number> | null;
}

/** Applies client filters, the mailbox tree and client sorting to the full row set. */
export function processClientRows(rows: ListItem[], plan: ClientPlan, objectName: string): ProcessedRows {
  let items = rows.filter((item) => plan.filters.every((f) => String(item[f.field] ?? '') === f.value));
  if (plan.problemsOnly) items = items.filter((item) => reportHasProblems(objectName, item));

  let depths: Map<string, number> | null = null;
  if (plan.hierarchy) {
    const tree = sortMailboxesByHierarchy(items);
    items = tree.items;
    depths = tree.depths;
  }

  if (plan.clientSort) {
    const direction = plan.clientSort.ascending ? 1 : -1;
    const field = plan.clientSort.field;
    items = [...items].sort((a, b) => {
      const av = getClientSortValue(field, a);
      const bv = getClientSortValue(field, b);
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return cmp * direction;
    });
  }
  return { items, depths };
}
