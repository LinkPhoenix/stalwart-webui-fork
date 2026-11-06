/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import type { ClusterNodeInfo, Metric, MetricId, Period, PresetKey } from './types/metrics';
import type {
  Aggregate,
  Card,
  Dashboard,
  DashboardItem,
  Headline,
  MetricFormat,
  MetricScope,
  Polarity,
  Ranking,
} from './types/schema';
import { PRESET_MS, BUCKET_CONFIG, CUSTOM_BUCKET_COUNT, SPARKLINE_BUCKET_COUNT } from './types/metrics';
import { formatCompactNumber, formatDate, formatElapsed, formatPercent, formatSize, formatTime } from '@/lib/format';

export function periodWindow(p: Period): { from: Date; to: Date } {
  if (p.kind === 'custom') return { from: p.from, to: p.to };
  const to = new Date();
  const ms = PRESET_MS[p.preset];
  return { from: new Date(to.getTime() - ms), to };
}

export function revivePeriod(raw: unknown): Period | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (p.kind === 'preset') {
    return typeof p.preset === 'string' && p.preset in PRESET_MS
      ? { kind: 'preset', preset: p.preset as PresetKey }
      : null;
  }
  if (p.kind === 'custom') {
    const from = new Date(p.from as string | number | Date);
    const to = new Date(p.to as string | number | Date);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) return null;
    return { kind: 'custom', from, to };
  }
  return null;
}

export function periodKey(p: Period): string {
  if (p.kind === 'custom') return `custom|${p.from.toISOString()}|${p.to.toISOString()}`;
  return p.preset;
}

export function getBucketCount(p: Period): number {
  if (p.kind === 'custom') return CUSTOM_BUCKET_COUNT;
  return BUCKET_CONFIG[p.preset];
}

function aggregate(values: number[], agg: Aggregate | undefined): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return agg === 'avg' ? sum / values.length : sum;
}

export interface MetricTarget {
  metrics: MetricId[];
  aggregate?: Aggregate;
  scope?: MetricScope;
}

export interface CarriedGauge {
  nodeId: number;
  value: number;
}

function nodeOf(m: Metric): number {
  return m.nodeId ?? 0;
}

function timeOf(m: Metric): number {
  return m.timestamp ? Date.parse(m.timestamp) : NaN;
}

function seriesKey(nodeId: number, metric: MetricId): string {
  return `${nodeId}:${metric}`;
}

function pushValue(groups: Map<number, number[]>, nodeId: number, value: number) {
  const list = groups.get(nodeId);
  if (list) list.push(value);
  else groups.set(nodeId, [value]);
}

const samplesByMetric = new WeakMap<Metric[], Map<MetricId, Metric[]>>();

function indexSamples(samples: Metric[]): Map<MetricId, Metric[]> {
  let index = samplesByMetric.get(samples);
  if (!index) {
    index = new Map();
    for (const m of samples) {
      const list = index.get(m.metric);
      if (list) list.push(m);
      else index.set(m.metric, [m]);
    }
    samplesByMetric.set(samples, index);
  }
  return index;
}

export function selectSamples(target: MetricTarget, samples: Metric[]): Metric[] {
  const index = indexSamples(samples);
  const unique = new Set(target.metrics);
  if (unique.size === 1) return index.get(target.metrics[0]) ?? [];
  return [...unique].flatMap((id) => index.get(id) ?? []);
}

export function latestSamples(samples: Metric[]): Metric[] {
  const latest = new Map<string, Metric>();
  for (const m of samples) {
    const key = seriesKey(nodeOf(m), m.metric);
    const prev = latest.get(key);
    if (!prev || !(timeOf(m) < timeOf(prev))) latest.set(key, m);
  }
  return Array.from(latest.values());
}

export function reduceSamples(
  target: MetricTarget,
  samples: Metric[],
  carried: readonly CarriedGauge[] = [],
): number | null {
  const counters: number[] = [];
  const histograms = new Map<MetricId, { count: number; sum: number }>();
  const gauges = new Map<number, number[]>();

  for (const m of target.aggregate === 'last' ? latestSamples(samples) : samples) {
    switch (m['@type']) {
      case 'Counter':
        counters.push(m.count);
        break;
      case 'Histogram': {
        const acc = histograms.get(m.metric);
        if (acc) {
          acc.count += m.count;
          acc.sum += m.sum;
        } else {
          histograms.set(m.metric, { count: m.count, sum: m.sum });
        }
        break;
      }
      case 'Gauge':
        pushValue(gauges, nodeOf(m), m.count);
        break;
    }
  }
  for (const c of carried) pushValue(gauges, c.nodeId, c.value);

  let result: number | null = null;
  if (counters.length > 0) result = aggregate(counters, target.aggregate);

  const means: number[] = [];
  for (const { count, sum } of histograms.values()) {
    if (count > 0) means.push(sum / count);
  }
  if (means.length > 0) result = (result ?? 0) + aggregate(means, target.aggregate);

  if (gauges.size > 0) {
    const perNode = (target.scope ?? 'cluster') === 'node';
    let combined = perNode ? 0 : -Infinity;
    for (const values of gauges.values()) {
      const v = aggregate(values, target.aggregate);
      combined = perNode ? combined + v : Math.max(combined, v);
    }
    result = (result ?? 0) + combined;
  }

  return result;
}

function median(sorted: number[]): number {
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function inferSamplingIntervals(samples: Metric[]): Map<string, number> {
  const times = new Map<string, number[]>();
  for (const m of samples) {
    if (m['@type'] !== 'Gauge') continue;
    const t = timeOf(m);
    if (Number.isNaN(t)) continue;
    const key = seriesKey(nodeOf(m), m.metric);
    const list = times.get(key);
    if (list) list.push(t);
    else times.set(key, [t]);
  }

  const intervals = new Map<string, number>();
  for (const [key, list] of times) {
    if (list.length < 2) continue;
    list.sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < list.length; i++) {
      const gap = list[i] - list[i - 1];
      if (gap > 0) gaps.push(gap);
    }
    if (gaps.length === 0) continue;
    gaps.sort((a, b) => a - b);
    intervals.set(key, median(gaps));
  }
  return intervals;
}

export function bucketValues(
  target: MetricTarget,
  samples: Metric[],
  from: Date,
  to: Date,
  bucketCount: number,
): (number | null)[] {
  const selected = selectSamples(target, samples);
  const buckets = bucketize(selected, from, to, bucketCount);
  const intervals = (target.scope ?? 'cluster') === 'node' ? inferSamplingIntervals(selected) : null;
  if (!intervals || intervals.size === 0) return buckets.map((bucket) => reduceSamples(target, bucket));

  const width = (to.getTime() - from.getTime()) / bucketCount;
  const last = new Map<string, { nodeId: number; time: number; value: number }>();

  return buckets.map((bucket, i) => {
    const start = from.getTime() + width * i;
    const latest = new Map<string, { nodeId: number; time: number; value: number }>();
    for (const m of bucket) {
      if (m['@type'] !== 'Gauge') continue;
      const nodeId = nodeOf(m);
      const key = seriesKey(nodeId, m.metric);
      const time = timeOf(m);
      const prev = latest.get(key);
      if (!prev || time >= prev.time) latest.set(key, { nodeId, time, value: m.count });
    }

    const carried: CarriedGauge[] = [];
    for (const [key, prev] of last) {
      if (latest.has(key)) continue;
      const interval = intervals.get(key);
      if (interval !== undefined && start - prev.time < interval) {
        carried.push({ nodeId: prev.nodeId, value: prev.value });
      }
    }
    for (const [key, cur] of latest) last.set(key, cur);

    return reduceSamples(target, bucket, carried);
  });
}

export function cardValue(card: Card, samples: Metric[]): number {
  return reduceSamples(card, selectSamples(card, samples)) ?? 0;
}

export function bucketize(samples: Metric[], from: Date, to: Date, bucketCount: number): Metric[][] {
  const buckets: Metric[][] = Array.from({ length: bucketCount }, () => []);
  const start = from.getTime();
  const end = to.getTime();
  const span = end - start;
  if (span <= 0) return buckets;
  for (const m of samples) {
    const t = timeOf(m);
    if (Number.isNaN(t) || t < start || t > end) continue;
    const idx = Math.min(bucketCount - 1, Math.floor(((t - start) / span) * bucketCount));
    buckets[idx].push(m);
  }
  return buckets;
}

export function bucketTimestamps(from: Date, to: Date, bucketCount: number): Date[] {
  const span = to.getTime() - from.getTime();
  const width = span / bucketCount;
  return Array.from({ length: bucketCount }, (_, i) => new Date(from.getTime() + width * (i + 0.5)));
}

export function computeDelta(
  card: Card,
  samples: Metric[],
  from: Date,
  to: Date,
): { pct: number; direction: 'up' | 'down' | 'neutral' } | null {
  const mid = (from.getTime() + to.getTime()) / 2;
  const firstHalf: Metric[] = [];
  const secondHalf: Metric[] = [];
  for (const m of selectSamples(card, samples)) {
    const t = timeOf(m);
    if (Number.isNaN(t)) continue;
    (t < mid ? firstHalf : secondHalf).push(m);
  }

  const first = reduceSamples(card, firstHalf) ?? 0;
  const second = reduceSamples(card, secondHalf) ?? 0;

  if (first === 0) return null;
  const pct = ((second - first) / Math.abs(first)) * 100;
  if (pct === 0) return { pct: 0, direction: 'neutral' };
  return { pct: Math.round(pct * 10) / 10, direction: pct > 0 ? 'up' : 'down' };
}

export function sparklineData(card: Card, samples: Metric[], from: Date, to: Date): number[] {
  return bucketValues(card, samples, from, to, SPARKLINE_BUCKET_COUNT).map((v) => v ?? 0);
}

export function distinctNodeIds(samples: Metric[]): number[] {
  const ids = new Set<number>();
  for (const m of samples) {
    if (m.nodeId !== undefined) ids.add(m.nodeId);
  }
  return Array.from(ids).sort((a, b) => a - b);
}

export function nodeOptions(
  registry: ClusterNodeInfo[] | undefined,
  seen: Iterable<number>,
  selected: number | null,
): ClusterNodeInfo[] {
  const byId = new Map<number, ClusterNodeInfo>();
  for (const node of registry ?? []) byId.set(node.nodeId, node);
  for (const nodeId of seen) {
    if (!byId.has(nodeId)) byId.set(nodeId, { nodeId });
  }
  if (selected !== null && !byId.has(selected)) byId.set(selected, { nodeId: selected });
  return Array.from(byId.values()).sort((a, b) => a.nodeId - b.nodeId);
}

export function formatValue(value: number, format: MetricFormat): string {
  switch (format) {
    case 'number':
      return formatCompactNumber(value);
    case 'bytes':
      return formatSize(value, { compact: true });
    case 'duration':
      return formatElapsed(value);
    case 'percent':
      return formatPercent(value);
    default:
      return String(value);
  }
}

const TICK_DATE: Intl.DateTimeFormatOptions = { month: '2-digit', day: '2-digit' };

export function formatTimeTick(date: Date, period: Period): string {
  const intraday =
    period.kind === 'preset' ? period.preset === '24h' : period.to.getTime() - period.from.getTime() <= 86_400_000;
  return intraday ? formatTime(date) : formatDate(date, TICK_DATE);
}

export function dashboardItems(dashboard: Dashboard): DashboardItem[] {
  if (dashboard.items && dashboard.items.length > 0) return dashboard.items;
  const charts = dashboard.charts ?? [];
  return [
    ...(dashboard.cards ?? []).map((card): DashboardItem => ({ type: 'stat', ...card })),
    ...charts.map((chart, i): DashboardItem => ({
      type: 'chart',
      ...chart,
      ...(charts.length % 2 === 1 && i === charts.length - 1 && { span: 12 }),
    })),
  ];
}

function itemHistoryMetrics(item: DashboardItem): MetricId[] {
  switch (item.type) {
    case 'stat':
      return item.source === 'history' ? item.metrics : [];
    case 'chart':
    case 'ranking':
      return item.series.flatMap((series) => series.metrics);
    case 'headline':
      return [...item.numerator, ...item.denominator];
  }
}

export function collectHistoryMetricIds(items: readonly DashboardItem[]): Set<MetricId> {
  return new Set(items.flatMap(itemHistoryMetrics));
}

export function collectLiveMetricIds(items: readonly DashboardItem[]): Set<MetricId> {
  return new Set(items.flatMap((item) => (item.type === 'stat' && item.source === 'live' ? item.metrics : [])));
}

export function headlineRatio(headline: Headline, samples: Metric[]): number | null {
  const reduce = (metrics: MetricId[]) => {
    const target = { metrics, aggregate: headline.aggregate, scope: headline.scope };
    return reduceSamples(target, selectSamples(target, samples)) ?? 0;
  };
  const denominator = reduce(headline.denominator);
  if (denominator <= 0) return null;
  return reduce(headline.numerator) / denominator;
}

interface RankingEntry {
  label: string;
  value: number;
}

export function rankingEntries(ranking: Ranking, samples: Metric[]): RankingEntry[] {
  return ranking.series
    .map((series) => ({ label: series.label, value: reduceSamples(series, selectSamples(series, samples)) ?? 0 }))
    .sort((a, b) => b.value - a.value);
}

export type DeltaSentiment = 'good' | 'bad' | 'neutral';

export function deltaSentiment(
  direction: 'up' | 'down' | 'neutral',
  polarity: Polarity = 'higherIsBetter',
): DeltaSentiment {
  if (direction === 'neutral' || polarity === 'neutral') return 'neutral';
  return (direction === 'up') === (polarity === 'higherIsBetter') ? 'good' : 'bad';
}
