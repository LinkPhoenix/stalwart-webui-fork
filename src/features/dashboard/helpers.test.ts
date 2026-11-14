import { describe, expect, it } from 'vitest';

import {
  bucketTimestamps,
  bucketValues,
  bucketize,
  cardValue,
  collectHistoryMetricIds,
  collectLiveMetricIds,
  computeDelta,
  dashboardItems,
  deltaSentiment,
  distinctNodeIds,
  getBucketCount,
  headlineRatio,
  inferSamplingIntervals,
  latestSamples,
  nodeOptions,
  periodKey,
  periodWindow,
  rankingEntries,
  reduceSamples,
  revivePeriod,
  selectSamples,
  sparklineData,
  type MetricTarget,
} from './helpers';
import type { Metric } from './types/metrics';
import type { Card, Dashboard, DashboardItem } from './types/schema';

const counter = (metric: string, count: number, timestamp?: string, nodeId?: number): Metric => ({
  '@type': 'Counter',
  metric,
  count,
  timestamp,
  nodeId,
});
const gauge = (metric: string, count: number, timestamp?: string, nodeId?: number): Metric => ({
  '@type': 'Gauge',
  metric,
  count,
  timestamp,
  nodeId,
});
const histogram = (metric: string, count: number, sum: number, timestamp?: string): Metric => ({
  '@type': 'Histogram',
  metric,
  count,
  sum,
  timestamp,
});

const statCard = (overrides: Partial<Card> = {}): Card => ({
  title: 't',
  icon: 'i',
  source: 'history',
  metrics: ['m'],
  format: 'number',
  ...overrides,
});

describe('periodWindow', () => {
  it('returns a 24h window for the 24h preset', () => {
    const { from, to } = periodWindow({ kind: 'preset', preset: '24h' });
    expect(to.getTime() - from.getTime()).toBe(86_400_000);
  });

  it('returns the custom range unchanged', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-01-02T00:00:00Z');
    expect(periodWindow({ kind: 'custom', from, to })).toEqual({ from, to });
  });
});

describe('revivePeriod', () => {
  it('revives a valid preset', () => {
    expect(revivePeriod({ kind: 'preset', preset: '7d' })).toEqual({ kind: 'preset', preset: '7d' });
  });

  it('rejects unknown presets and non-objects', () => {
    expect(revivePeriod({ kind: 'preset', preset: '1y' })).toBeNull();
    expect(revivePeriod(null)).toBeNull();
    expect(revivePeriod('24h')).toBeNull();
  });

  it('revives a valid custom range and rejects from >= to or invalid dates', () => {
    expect(revivePeriod({ kind: 'custom', from: '2026-01-01', to: '2026-01-02' })).toEqual({
      kind: 'custom',
      from: new Date('2026-01-01'),
      to: new Date('2026-01-02'),
    });
    expect(revivePeriod({ kind: 'custom', from: '2026-01-02', to: '2026-01-01' })).toBeNull();
    expect(revivePeriod({ kind: 'custom', from: 'nope', to: '2026-01-01' })).toBeNull();
  });
});

describe('periodKey / getBucketCount', () => {
  it('builds stable keys', () => {
    expect(periodKey({ kind: 'preset', preset: '24h' })).toBe('24h');
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-02T00:00:00.000Z');
    expect(periodKey({ kind: 'custom', from, to })).toBe('custom|2026-01-01T00:00:00.000Z|2026-01-02T00:00:00.000Z');
  });

  it('maps presets to bucket counts and custom to 60', () => {
    expect(getBucketCount({ kind: 'preset', preset: '24h' })).toBe(48);
    expect(getBucketCount({ kind: 'preset', preset: '90d' })).toBe(90);
    expect(getBucketCount({ kind: 'custom', from: new Date(0), to: new Date(1) })).toBe(60);
  });
});

describe('selectSamples', () => {
  const samples = [counter('a', 1), counter('b', 2), gauge('a', 3)];

  it('returns the samples of a single metric', () => {
    expect(selectSamples({ metrics: ['a'] }, samples)).toEqual([counter('a', 1), gauge('a', 3)]);
  });

  it('deduplicates repeated metric ids and skips missing ones', () => {
    expect(selectSamples({ metrics: ['a', 'a', 'missing'] }, samples)).toHaveLength(2);
    expect(selectSamples({ metrics: ['missing'] }, samples)).toEqual([]);
  });
});

describe('latestSamples', () => {
  it('keeps the newest sample per node+metric series', () => {
    const samples = [
      gauge('m', 1, '2026-01-01T00:00:00Z', 1),
      gauge('m', 9, '2026-01-02T00:00:00Z', 1),
      gauge('m', 2, '2026-01-03T00:00:00Z', 1),
      gauge('m', 5, '2026-01-05T00:00:00Z', 2),
    ];
    const latest = latestSamples(samples);
    expect(latest).toHaveLength(2);
    expect(latest.find((m) => m.nodeId === 1)?.count).toBe(2);
    expect(latest.find((m) => m.nodeId === 2)?.count).toBe(5);
  });
});

describe('reduceSamples', () => {
  const target = (overrides: Partial<MetricTarget> = {}): MetricTarget => ({ metrics: ['m'], ...overrides });

  it('sums counters by default and averages with avg', () => {
    const samples = [counter('m', 3), counter('m', 4)];
    expect(reduceSamples(target(), samples)).toBe(7);
    expect(reduceSamples(target({ aggregate: 'avg' }), samples)).toBe(3.5);
  });

  it("uses only the latest samples with aggregate 'last'", () => {
    const samples = [
      counter('m', 100, '2026-01-01T00:00:00Z'),
      counter('m', 5, '2026-01-02T00:00:00Z'),
    ];
    expect(reduceSamples(target({ aggregate: 'last' }), samples)).toBe(5);
  });

  it('takes the max across nodes for cluster-scoped gauges and the sum for node scope', () => {
    const samples = [gauge('m', 3, undefined, 1), gauge('m', 4, undefined, 1), gauge('m', 10, undefined, 2)];
    expect(reduceSamples(target({ scope: 'cluster' }), samples)).toBe(10);
    expect(reduceSamples(target({ scope: 'node' }), samples)).toBe(17);
  });

  it('adds carried gauge values', () => {
    expect(reduceSamples(target(), [], [{ nodeId: 1, value: 42 }])).toBe(42);
  });

  it('averages histogram means', () => {
    const samples = [histogram('m', 2, 10), histogram('m', 2, 20)];
    expect(reduceSamples(target(), samples)).toBe(7.5);
  });

  it('returns null when there is nothing to reduce', () => {
    expect(reduceSamples(target(), [])).toBeNull();
  });
});

describe('bucketize / bucketTimestamps', () => {
  const from = new Date('2026-01-01T00:00:00Z');
  const to = new Date('2026-01-01T01:00:00Z');

  it('distributes samples into buckets and clamps the end boundary', () => {
    const samples = [
      counter('m', 1, '2026-01-01T00:00:00Z'),
      counter('m', 2, '2026-01-01T00:30:00Z'),
      counter('m', 3, '2026-01-01T01:00:00Z'),
      counter('m', 4, '2025-12-31T23:00:00Z'),
      counter('m', 5, 'not-a-date'),
    ];
    const buckets = bucketize(samples, from, to, 2);
    expect(buckets[0].map((m) => m.count)).toEqual([1]);
    expect(buckets[1].map((m) => m.count)).toEqual([2, 3]);
  });

  it('returns empty buckets when the span is not positive', () => {
    expect(bucketize([counter('m', 1)], from, from, 4)).toEqual([[], [], [], []]);
  });

  it('places bucket timestamps at bucket centers', () => {
    const stamps = bucketTimestamps(from, to, 4);
    expect(stamps).toHaveLength(4);
    expect(stamps[0].getTime()).toBe(from.getTime() + (3_600_000 / 4) * 0.5);
  });
});

describe('bucketValues', () => {
  it('reduces each bucket and returns null for empty buckets', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-01-01T01:00:00Z');
    const samples = [counter('m', 2, '2026-01-01T00:10:00Z'), counter('m', 6, '2026-01-01T00:50:00Z')];
    const values = bucketValues({ metrics: ['m'] }, samples, from, to, 2);
    expect(values).toEqual([2, 6]);
    expect(bucketValues({ metrics: ['m'] }, [], from, to, 2)).toEqual([null, null]);
  });
});

describe('computeDelta / deltaSentiment', () => {
  const from = new Date('2026-01-01T00:00:00Z');
  const to = new Date('2026-01-01T02:00:00Z');

  it('computes the percentage change between the two halves', () => {
    const samples = [counter('m', 10, '2026-01-01T00:30:00Z'), counter('m', 15, '2026-01-01T01:30:00Z')];
    expect(computeDelta(statCard(), samples, from, to)).toEqual({ pct: 50, direction: 'up' });
  });

  it('returns null when the first half is zero and neutral on no change', () => {
    expect(computeDelta(statCard(), [counter('m', 0, '2026-01-01T00:30:00Z')], from, to)).toBeNull();
    const flat = [counter('m', 5, '2026-01-01T00:30:00Z'), counter('m', 5, '2026-01-01T01:30:00Z')];
    expect(computeDelta(statCard(), flat, from, to)).toEqual({ pct: 0, direction: 'neutral' });
  });

  it('maps direction+polarity to a sentiment', () => {
    expect(deltaSentiment('up', 'higherIsBetter')).toBe('good');
    expect(deltaSentiment('up', 'lowerIsBetter')).toBe('bad');
    expect(deltaSentiment('down', 'lowerIsBetter')).toBe('good');
    expect(deltaSentiment('neutral')).toBe('neutral');
    expect(deltaSentiment('up', 'neutral')).toBe('neutral');
  });
});

describe('cardValue / sparklineData', () => {
  it('reduces the card metrics and defaults to 0', () => {
    expect(cardValue(statCard(), [counter('m', 3)])).toBe(3);
    expect(cardValue(statCard(), [])).toBe(0);
  });

  it('produces one sparkline point per bucket', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-01-01T01:00:00Z');
    const samples = [counter('m', 1, '2026-01-01T00:10:00Z'), counter('m', 2, '2026-01-01T00:50:00Z')];
    expect(sparklineData(statCard(), samples, from, to)).toHaveLength(20);
  });
});

describe('inferSamplingIntervals', () => {
  it('returns the median positive gap per gauge series', () => {
    const samples = [
      gauge('m', 1, '2026-01-01T00:00:00Z', 1),
      gauge('m', 1, '2026-01-01T00:01:00Z', 1),
      gauge('m', 1, '2026-01-01T00:03:00Z', 1),
      counter('m', 1, '2026-01-01T00:00:30Z', 1),
    ];
    const intervals = inferSamplingIntervals(samples);
    expect(intervals.get('1:m')).toBe(90_000);
  });

  it('ignores series with fewer than two samples', () => {
    expect(inferSamplingIntervals([gauge('m', 1, '2026-01-01T00:00:00Z', 1)])).toEqual(new Map());
  });
});

describe('distinctNodeIds / nodeOptions', () => {
  it('returns sorted unique node ids, ignoring undefined', () => {
    const samples = [gauge('m', 1, undefined, 2), gauge('m', 1, undefined, 1), counter('m', 1)];
    expect(distinctNodeIds(samples)).toEqual([1, 2]);
  });

  it('merges registry, seen and selected node ids sorted by id', () => {
    const options = nodeOptions([{ nodeId: 3, hostname: 'c' }], [2], 1);
    expect(options.map((o) => o.nodeId)).toEqual([1, 2, 3]);
    expect(options.find((o) => o.nodeId === 3)?.hostname).toBe('c');
  });
});

describe('dashboardItems', () => {
  it('prefers explicit items over the legacy cards/charts layout', () => {
    const items: DashboardItem[] = [{ type: 'stat', ...statCard() }];
    const dashboard: Dashboard = { id: 'd', label: 'd', items, cards: [statCard()], charts: [] };
    expect(dashboardItems(dashboard)).toBe(items);
  });

  it('maps cards to stat items and gives an odd last chart full span', () => {
    const dashboard: Dashboard = {
      id: 'd',
      label: 'd',
      cards: [statCard({ title: 'c1' })],
      charts: [
        { title: 'ch1', kind: 'line', series: [] },
        { title: 'ch2', kind: 'line', series: [] },
        { title: 'ch3', kind: 'line', series: [] },
      ],
    };
    const items = dashboardItems(dashboard);
    expect(items.map((i) => i.type)).toEqual(['stat', 'chart', 'chart', 'chart']);
    expect(items[3].span).toBe(12);
    expect(items[1].span).toBeUndefined();
  });
});

describe('metric id collection', () => {
  const items: DashboardItem[] = [
    { type: 'stat', ...statCard({ source: 'history', metrics: ['h1'] }) },
    { type: 'stat', ...statCard({ source: 'live', metrics: ['l1'] }) },
    { type: 'chart', title: 'c', kind: 'line', series: [{ label: 's', metrics: ['c1', 'c2'] }] },
    { type: 'ranking', title: 'r', series: [{ label: 's', metrics: ['r1'] }] },
    { type: 'headline', title: 'h', numerator: ['n1'], denominator: ['d1'] },
  ];

  it('collects history metric ids from stat history, charts, rankings and headlines', () => {
    expect([...collectHistoryMetricIds(items)].sort()).toEqual(['c1', 'c2', 'd1', 'h1', 'n1', 'r1']);
  });

  it('collects live metric ids only from live stat cards', () => {
    expect([...collectLiveMetricIds(items)]).toEqual(['l1']);
  });
});

describe('headlineRatio / rankingEntries', () => {
  it('returns null when the denominator is not positive', () => {
    const headline = { title: 'h', numerator: ['n'], denominator: ['d'] };
    expect(headlineRatio(headline, [counter('d', 0)])).toBeNull();
  });

  it('computes numerator / denominator', () => {
    const headline = { title: 'h', numerator: ['n'], denominator: ['d'] };
    const samples = [counter('n', 3), counter('d', 4)];
    expect(headlineRatio(headline, samples)).toBe(0.75);
  });

  it('ranks series by descending value', () => {
    const ranking = {
      title: 'r',
      series: [
        { label: 'low', metrics: ['a'] },
        { label: 'high', metrics: ['b'] },
      ],
    };
    const entries = rankingEntries(ranking, [counter('a', 1), counter('b', 9)]);
    expect(entries.map((e) => e.label)).toEqual(['high', 'low']);
  });
});
