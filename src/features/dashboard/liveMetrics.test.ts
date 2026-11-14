import { describe, expect, it } from 'vitest';

import { isMetric, parseMetricBatch } from './liveMetrics';

describe('isMetric', () => {
  it('accepts Counter and Gauge samples', () => {
    expect(isMetric({ '@type': 'Counter', metric: 'm', count: 1 })).toBe(true);
    expect(isMetric({ '@type': 'Gauge', metric: 'm', count: 2, nodeId: 1, timestamp: '2026-01-01T00:00:00Z' })).toBe(
      true,
    );
  });

  it('requires sum on histograms', () => {
    expect(isMetric({ '@type': 'Histogram', metric: 'm', count: 2, sum: 10 })).toBe(true);
    expect(isMetric({ '@type': 'Histogram', metric: 'm', count: 2 })).toBe(false);
  });

  it('rejects unknown types, missing fields and non-objects', () => {
    expect(isMetric({ '@type': 'Other', metric: 'm', count: 1 })).toBe(false);
    expect(isMetric({ '@type': 'Counter', count: 1 })).toBe(false);
    expect(isMetric({ '@type': 'Counter', metric: 'm', count: '1' })).toBe(false);
    expect(isMetric(null)).toBe(false);
    expect(isMetric('m')).toBe(false);
  });
});

describe('parseMetricBatch', () => {
  it('parses a JSON array of metrics', () => {
    const batch = parseMetricBatch('[{"@type":"Counter","metric":"m","count":1}]');
    expect(batch).toEqual([{ '@type': 'Counter', metric: 'm', count: 1 }]);
  });

  it('wraps a single JSON object into an array', () => {
    const batch = parseMetricBatch('{"@type":"Gauge","metric":"m","count":3}');
    expect(batch).toHaveLength(1);
  });

  it('throws when any item is not a metric', () => {
    expect(() => parseMetricBatch('[{"@type":"Counter","metric":"m","count":1},{"nope":true}]')).toThrow(TypeError);
  });
});
