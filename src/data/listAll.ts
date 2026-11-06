import { useQuery } from '@tanstack/react-query';
import i18n from '@/i18n';
import { jmapKeys, type ListPageParams } from '@/data/keys';
import { toast } from '@/hooks/use-toast';
import { FETCH_ALL_HARD_CAP, evaluateFetchAllTotal, probeQueryTotal } from '@/lib/fetchAllGuardrails';
import { jmapQueryAllAndGet, type JmapObject } from '@/services/jmap/client';

/**
 * SCHEMA-DEVIATION: log-client-filters, account-client-sort, mailbox-client-hierarchy-sort,
 * report-problems-only-filter (see SCHEMA_DEVIATIONS.md)
 *
 * Fetches every row matching the server-side filter, behind the fetch-all
 * guardrails (warn above 2 000 rows, refuse above 10 000). The list then
 * filters, sorts and paginates the rows in the browser.
 */
export function fetchAllRowsQuery(objectName: string, params: ListPageParams) {
  const { properties, ...query } = params;
  return {
    queryKey: [...jmapKeys.lists(objectName), 'all', params] as const,
    staleTime: 0,
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<JmapObject[]> => {
      const probe = evaluateFetchAllTotal(await probeQueryTotal(objectName, query));
      if (!probe.ok) {
        throw new Error(
          i18n.t(
            'list.fetchAllHardCap',
            'Refusing to load {{count}} matching rows into the browser (limit {{cap}}). Narrow filters or export from a smaller set.',
            { count: probe.total, cap: FETCH_ALL_HARD_CAP },
          ),
        );
      }
      if (probe.warn) {
        toast({
          title: i18n.t('list.fetchAllWarn', 'Loading {{count}} rows into the browser — this may be slow.', {
            count: probe.total,
          }),
        });
      }
      const { list } = await jmapQueryAllAndGet(objectName, query, properties, { signal });
      return list;
    },
  };
}

export function useJmapListAll(objectName: string | null | undefined, params: ListPageParams) {
  return useQuery({
    ...fetchAllRowsQuery(objectName ?? '', params),
    enabled: !!objectName,
    placeholderData: (previous) => previous,
  });
}
