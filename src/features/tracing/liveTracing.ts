/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import type { StreamParams } from '@/services/sse';
import type { TraceEvent } from './types';

export const MAX_LIVE_EVENTS = 1000;

export interface KeyValueFilter {
  key: string;
  label: string;
  value: string;
}

export interface TraceBuffer {
  events: TraceEvent[];
  dropped: number;
  anchorTimestamp: string | null;
}

export const EMPTY_TRACE_BUFFER: TraceBuffer = { events: [], dropped: 0, anchorTimestamp: null };

export function appendTraceEvents(buffer: TraceBuffer, batch: TraceEvent[], max = MAX_LIVE_EVENTS): TraceBuffer {
  if (batch.length === 0) return buffer;
  const combined = buffer.events.concat(batch);
  const overflow = Math.max(0, combined.length - max);
  return {
    events: overflow > 0 ? combined.slice(overflow) : combined,
    dropped: buffer.dropped + overflow,
    anchorTimestamp: buffer.anchorTimestamp ?? batch[0].timestamp,
  };
}

export function upsertFilter(filters: KeyValueFilter[], next: KeyValueFilter): KeyValueFilter[] {
  const index = filters.findIndex((f) => f.key === next.key);
  if (index === -1) return [...filters, next];
  return filters.map((f, i) => (i === index ? next : f));
}

export function buildTracingParams(keywords: string, filters: KeyValueFilter[]): StreamParams {
  const params: StreamParams = {};
  const filter = keywords.trim();
  if (filter) params.filter = filter;
  for (const f of filters) {
    if (f.key !== 'filter' && f.key !== 'token') params[f.key] = f.value;
  }
  return params;
}
