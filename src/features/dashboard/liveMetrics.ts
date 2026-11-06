/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { parseJsonBatch } from '@/services/sse';
import type { Metric } from './types/metrics';

const METRIC_TYPES = new Set(['Counter', 'Gauge', 'Histogram']);

export function isMetric(value: unknown): value is Metric {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m['@type'] === 'string' &&
    METRIC_TYPES.has(m['@type']) &&
    typeof m.metric === 'string' &&
    typeof m.count === 'number' &&
    (m['@type'] !== 'Histogram' || typeof m.sum === 'number')
  );
}

export const parseMetricBatch = parseJsonBatch(isMetric);
