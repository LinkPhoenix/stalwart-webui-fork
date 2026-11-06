/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { useQuery } from '@tanstack/react-query';
import { jmapKeys } from '@/data/keys';
import { jmapQueryAllAndGet } from '@/services/jmap/client';
import { periodKey, periodWindow } from './helpers';
import type { ClusterNodeInfo, Metric, MetricId, Period } from './types/metrics';

const HISTORY_STALE_MS = 60_000;

export interface HistoryMetrics {
  metrics: Metric[];
  window: { from: Date; to: Date };
}

export function historyMetricsKey(period: Period, ids: Set<MetricId>, nodeId: number | null = null) {
  return [...jmapKeys.type('x:Metric'), 'history', periodKey(period), nodeId ?? 'all', Array.from(ids).sort()] as const;
}

export function historyMetricsFilter(
  window: { from: Date; to: Date },
  ids: Set<MetricId>,
  nodeId: number | null,
): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    timestampIsGreaterThanOrEqual: window.from.toISOString(),
    timestampIsLessThanOrEqual: window.to.toISOString(),
    metric: Array.from(ids),
  };
  if (nodeId !== null) filter.nodeId = nodeId;
  return filter;
}

export async function fetchHistoryMetrics(
  period: Period,
  ids: Set<MetricId>,
  nodeId: number | null,
  signal?: AbortSignal,
): Promise<HistoryMetrics> {
  const window = periodWindow(period);
  if (ids.size === 0) return { metrics: [], window };
  const { list } = await jmapQueryAllAndGet(
    'x:Metric',
    { filter: historyMetricsFilter(window, ids, nodeId) },
    undefined,
    { signal },
  );
  return { metrics: list as unknown as Metric[], window };
}

export function useHistoryMetrics(period: Period, ids: Set<MetricId>, nodeId: number | null = null, enabled = true) {
  return useQuery({
    queryKey: historyMetricsKey(period, ids, nodeId),
    queryFn: ({ signal }) => fetchHistoryMetrics(period, ids, nodeId, signal),
    enabled: enabled && ids.size > 0,
    staleTime: HISTORY_STALE_MS,
    placeholderData: (previous) => previous,
  });
}

export function clusterNodesKey() {
  return [...jmapKeys.type('x:ClusterNode'), 'dashboardNodes'] as const;
}

export function parseClusterNodes(list: Record<string, unknown>[]): ClusterNodeInfo[] {
  const nodes: ClusterNodeInfo[] = [];
  for (const item of list) {
    const nodeId = item.nodeId;
    if (typeof nodeId !== 'number' || !Number.isInteger(nodeId)) continue;
    const hostname = typeof item.hostname === 'string' && item.hostname !== '' ? item.hostname : undefined;
    nodes.push({ nodeId, hostname });
  }
  return nodes.sort((a, b) => a.nodeId - b.nodeId);
}

export function useClusterNodes(enabled: boolean) {
  return useQuery({
    queryKey: clusterNodesKey(),
    queryFn: async ({ signal }) => {
      const { list } = await jmapQueryAllAndGet('x:ClusterNode', {}, ['nodeId', 'hostname'], { signal });
      return parseClusterNodes(list);
    },
    enabled,
    staleTime: HISTORY_STALE_MS,
  });
}
