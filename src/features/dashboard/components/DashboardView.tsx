/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSchemaStore } from '@/stores/schemaStore';
import type { Dashboard, DashboardItem } from '../types/schema';
import type { Metric } from '../types/metrics';
import { useDashboardStore } from '../stores/dashboardStore';
import { useLiveMetricsStore } from '../stores/liveMetricsStore';
import { useClusterNodes, useHistoryMetrics } from '../queries';
import { useCanAccess } from '@/hooks/usePermissions';
import { errorMessage } from '@/lib/jmapErrors';
import {
  collectHistoryMetricIds,
  collectLiveMetricIds,
  dashboardItems,
  distinctNodeIds,
  nodeOptions,
  periodWindow,
} from '../helpers';
import { StatCard } from './StatCard';
import { DashboardChart } from './DashboardChart';
import { PeriodSelector } from './PeriodSelector';
import { NodeSelector } from './NodeSelector';
import { HeadlineTile } from './HeadlineTile';
import { RankingTile } from './RankingTile';
import { cn } from '@/lib/utils';

const EMPTY_METRICS: Metric[] = [];
const EMPTY_ITEMS: DashboardItem[] = [];

const SPAN_CLASSES = [
  'col-span-12 md:col-span-6 xl:col-span-1',
  'col-span-12 md:col-span-6 xl:col-span-2',
  'col-span-12 md:col-span-6 xl:col-span-3',
  'col-span-12 md:col-span-6 xl:col-span-4',
  'col-span-12 xl:col-span-5',
  'col-span-12 xl:col-span-6',
  'col-span-12 xl:col-span-7',
  'col-span-12 xl:col-span-8',
  'col-span-12 xl:col-span-9',
  'col-span-12 xl:col-span-10',
  'col-span-12 xl:col-span-11',
  'col-span-12',
] as const;

const DEFAULT_SPAN: Record<DashboardItem['type'], number> = {
  stat: 3,
  chart: 6,
  headline: 4,
  ranking: 4,
};

function placementClass(item: DashboardItem): string {
  return cn(SPAN_CLASSES[(item.span ?? DEFAULT_SPAN[item.type]) - 1], item.rows === 2 && 'xl:row-span-2');
}

interface DashboardViewProps {
  dashboardId: string;
  section: string;
}

export function DashboardView({ dashboardId, section }: DashboardViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const schema = useSchemaStore((s) => s.schema);
  const period = useDashboardStore((s) => s.period);
  const nodeId = useDashboardStore((s) => s.nodeId);
  const setNodeId = useDashboardStore((s) => s.setNodeId);
  const canReadNodes = useCanAccess('x:ClusterNode', 'Get');
  const subscribeLive = useLiveMetricsStore((s) => s.subscribe);
  const unsubscribeLive = useLiveMetricsStore((s) => s.unsubscribe);
  const liveStatus = useLiveMetricsStore((s) => s.status);
  const liveError = useLiveMetricsStore((s) => s.error);

  const dashboards = useMemo<Dashboard[]>(() => schema?.dashboards ?? [], [schema]);
  const dashboard = dashboards.find((d) => d.id === dashboardId);

  useEffect(() => {
    if (!dashboard && dashboards.length > 0) {
      navigate(`/${section}/Dashboard/${dashboards[0].id}`, { replace: true });
    }
  }, [dashboard, dashboards, navigate, section]);

  const items = useMemo(() => (dashboard ? dashboardItems(dashboard) : EMPTY_ITEMS), [dashboard]);
  const historyIds = useMemo(() => collectHistoryMetricIds(items), [items]);
  const liveIds = useMemo(() => collectLiveMetricIds(items), [items]);

  const history = useHistoryMetrics(period, historyIds, nodeId);
  const allNodesHistory = useHistoryMetrics(period, historyIds, null, nodeId === null);
  const clusterNodes = useClusterNodes(canReadNodes);
  const historySamples = history.data?.metrics ?? EMPTY_METRICS;
  const historyWindow = history.data?.window ?? periodWindow(period);
  const nodes = nodeOptions(
    clusterNodes.data,
    distinctNodeIds(allNodesHistory.data?.metrics ?? historySamples),
    nodeId,
  );
  const showNodeSelector = nodes.length > 1 || nodeId !== null;

  useEffect(() => {
    if (liveIds.size > 0) {
      subscribeLive(liveIds);
    }
    return () => {
      unsubscribeLive();
    };
  }, [liveIds, subscribeLive, unsubscribeLive]);

  const isLoading = history.isFetching;
  const { refetch: refetchHistory } = history;

  const handleRefresh = useCallback(() => {
    if (historyIds.size > 0) void refetchHistory();
  }, [historyIds, refetchHistory]);

  if (!dashboard) {
    if (dashboards.length === 0) {
      return (
        <div className="rounded-2xl bg-muted p-10 text-center text-muted-foreground">
          {t('dashboard.noDashboards', 'No dashboards configured.')}
        </div>
      );
    }
    return null;
  }

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-end justify-between gap-4 px-1 pb-1 pt-3">
        {dashboards.length > 1 && (
          <Tabs
            className="min-w-0 max-w-full"
            value={dashboardId}
            onValueChange={(id) => navigate(`/${section}/Dashboard/${id}`)}
          >
            <TabsList className="max-w-full justify-start overflow-x-auto">
              {dashboards.map((d) => (
                <TabsTrigger key={d.id} value={d.id}>
                  {d.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
        {dashboards.length === 1 && <h1 className="page-title">{dashboard.label}</h1>}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {showNodeSelector && <NodeSelector nodes={nodes} value={nodeId} onChange={setNodeId} />}
          <PeriodSelector onRefresh={handleRefresh} loading={isLoading} />
        </div>
      </div>

      {history.isError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl bg-destructive-soft p-4 text-sm text-destructive"
        >
          <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
          {errorMessage(history.error, t('dashboard.failedFetchMetrics', 'Failed to fetch metrics'))}
        </div>
      )}

      {liveStatus === 'error' && liveError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl bg-destructive-soft p-4 text-sm text-destructive"
        >
          <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
          {liveError}
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-flow-row-dense grid-cols-12 gap-3.5 xl:grid-flow-row">
          {items.map((item, i) => {
            const key = `${item.type}-${item.title}-${i}`;
            const className = placementClass(item);
            switch (item.type) {
              case 'stat':
                return (
                  <StatCard
                    key={key}
                    card={item}
                    className={className}
                    historySamples={historySamples}
                    historyWindow={historyWindow}
                  />
                );
              case 'chart':
                return (
                  <DashboardChart
                    key={key}
                    chart={item}
                    className={className}
                    historySamples={historySamples}
                    historyWindow={historyWindow}
                    period={period}
                  />
                );
              case 'headline':
                return <HeadlineTile key={key} headline={item} className={className} historySamples={historySamples} />;
              case 'ranking':
                return <RankingTile key={key} ranking={item} className={className} historySamples={historySamples} />;
            }
          })}
        </div>
      )}
    </div>
  );
}
