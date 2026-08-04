/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSchemaStore } from '@/stores/schemaStore';
import type { Dashboard } from '../types/schema';
import { useDashboardStore } from '../stores/dashboardStore';
import { useLiveMetricsStore } from '../stores/liveMetricsStore';
import { useHistoryMetricsStore } from '../stores/historyMetricsStore';
import { collectHistoryMetricIds, collectLiveMetricIds, periodKey, periodWindow, deltaHistograms } from '../helpers';
import { StatCard } from './StatCard';
import { DashboardChart } from './DashboardChart';
import { PeriodSelector } from './PeriodSelector';

interface DashboardViewProps {
  dashboardId: string;
  section: string;
}

export function DashboardView({ dashboardId, section }: DashboardViewProps) {
  const navigate = useNavigate();
  const schema = useSchemaStore((s) => s.schema);
  const period = useDashboardStore((s) => s.period);
  const fetchHistory = useHistoryMetricsStore((s) => s.fetch);
  const refreshHistory = useHistoryMetricsStore((s) => s.refresh);
  const historyStatus = useHistoryMetricsStore((s) => s.status);
  const historyCache = useHistoryMetricsStore((s) => s.cache);
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

  const historyIds = useMemo(
    () => (dashboard ? collectHistoryMetricIds(dashboard.cards, dashboard.charts) : new Set<string>()),
    [dashboard],
  );
  const liveIds = useMemo(() => (dashboard ? collectLiveMetricIds(dashboard.cards) : new Set<string>()), [dashboard]);

  const cacheKey = dashboard ? `${dashboard.id}|${periodKey(period)}` : '';
  const [fetchVersion, setFetchVersion] = useState(0);

  useEffect(() => {
    if (!dashboard || historyIds.size === 0) return;
    let cancelled = false;
    fetchHistory(dashboard.id, period, historyIds).then(() => {
      if (!cancelled) setFetchVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [dashboard, period, historyIds, fetchHistory]);

  const { historySamples, historyWindow } = useMemo(() => {
    void fetchVersion;
    const raw = historyCache.get(cacheKey)?.metrics ?? [];
    return {
      historySamples: deltaHistograms(raw),
      historyWindow: periodWindow(period),
    };
  }, [historyCache, cacheKey, fetchVersion, period]);

  useEffect(() => {
    if (liveIds.size > 0) {
      subscribeLive(liveIds);
    }
    return () => {
      unsubscribeLive();
    };
  }, [liveIds, subscribeLive, unsubscribeLive]);

  const isLoading = historyStatus.get(cacheKey) === 'loading';

  const handleRefresh = useCallback(() => {
    if (dashboard && historyIds.size > 0) {
      refreshHistory(dashboard.id, period, historyIds).then(() => setFetchVersion((v) => v + 1));
    }
  }, [dashboard, period, historyIds, refreshHistory]);

  if (!dashboard) {
    if (dashboards.length === 0) {
      return (
        <div className="flex items-center justify-center p-8 text-muted-foreground">No dashboards configured.</div>
      );
    }
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {dashboards.length > 1 && (
          <Tabs value={dashboardId}>
            <TabsList>
              {dashboards.map((d) => (
                <TabsTrigger key={d.id} value={d.id} asChild>
                  <Link to={`/${section}/Dashboard/${d.id}`}>{d.label}</Link>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
        {dashboards.length === 1 && <h1 className="text-xl font-semibold">{dashboard.label}</h1>}

        <PeriodSelector onRefresh={handleRefresh} loading={isLoading} />
      </div>

      {liveStatus === 'error' && liveError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {liveError}
        </div>
      )}

      {dashboard.cards && dashboard.cards.length > 0 && (
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
          {dashboard.cards.map((card, i) => (
            <StatCard
              key={`${card.title}-${i}`}
              card={card}
              historySamples={historySamples}
              historyWindow={historyWindow}
            />
          ))}
        </div>
      )}

      {dashboard.charts && dashboard.charts.length > 0 && (
        <div className="space-y-4">
          {dashboard.charts.map((chart, i) => (
            <DashboardChart
              key={`${chart.title}-${i}`}
              chart={chart}
              historySamples={historySamples}
              historyWindow={historyWindow}
              period={period}
            />
          ))}
        </div>
      )}
    </div>
  );
}
