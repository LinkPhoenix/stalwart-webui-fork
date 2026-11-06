/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { create } from 'zustand';
import i18n from '@/i18n';
import { errorMessage } from '@/lib/jmapErrors';
import { openEventStream, type EventStream, type StreamStatus } from '@/services/sse';
import type { MetricId, Metric } from '../types/metrics';
import { parseMetricBatch } from '../liveMetrics';

type LiveStatus = 'idle' | 'connecting' | 'open' | 'error' | 'closed';

interface LiveMetricsState {
  snapshot: Map<MetricId, Metric>;
  subscribedIds: Set<MetricId>;
  status: LiveStatus;
  error: string | null;

  subscribe: (ids: Set<MetricId>) => void;
  unsubscribe: () => void;
  handleBatch: (batch: Metric[]) => void;
}

const SUBSCRIBE_DEBOUNCE_MS = 200;
const HIDDEN_CLOSE_DELAY_MS = 60_000;
const LIVE_INTERVAL_SECONDS = '30';

let stream: EventStream | null = null;
let generation = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let visibilityTimer: ReturnType<typeof setTimeout> | null = null;

function liveStatus(status: StreamStatus): Pick<LiveMetricsState, 'status' | 'error'> {
  switch (status.kind) {
    case 'idle':
      return { status: 'idle', error: null };
    case 'connecting':
    case 'reconnecting':
      return { status: 'connecting', error: null };
    case 'open':
      return { status: 'open', error: null };
    case 'closed':
      return { status: 'closed', error: null };
    case 'failed':
      return {
        status: 'error',
        error:
          status.error.reason === 'token'
            ? errorMessage(
                status.error.cause,
                i18n.t('dashboard.liveMetricsFailed', 'Failed to connect to live metrics.'),
              )
            : status.error.reason === 'rejected'
              ? i18n.t('dashboard.liveMetricsRejected', 'The server refused the live metrics stream.')
              : i18n.t('dashboard.liveMetricsDisconnected', 'Live metrics stream disconnected after multiple retries.'),
      };
  }
}

function closeStream() {
  generation++;
  const current = stream;
  stream = null;
  current?.stop();
}

function openStream(ids: Set<MetricId>) {
  closeStream();
  if (ids.size === 0) {
    useLiveMetricsStore.setState({ status: 'idle', error: null, subscribedIds: ids });
    return;
  }
  useLiveMetricsStore.setState({ subscribedIds: ids });
  const session = generation;
  stream = openEventStream<Metric[]>({
    tokenPath: '/api/token/metrics',
    path: '/api/live/metrics',
    params: { interval: LIVE_INTERVAL_SECONDS, metrics: Array.from(ids).join(',') },
    eventName: 'metrics',
    parse: parseMetricBatch,
    onMessage: (batch) => {
      if (session === generation) useLiveMetricsStore.getState().handleBatch(batch);
    },
    onStatus: (status) => {
      if (session === generation) useLiveMetricsStore.setState(liveStatus(status));
    },
  });
}

function clearTimer(timer: ReturnType<typeof setTimeout> | null) {
  if (timer !== null) clearTimeout(timer);
}

function handleVisibilityChange() {
  if (document.hidden) {
    clearTimer(visibilityTimer);
    visibilityTimer = setTimeout(() => {
      visibilityTimer = null;
      if (stream) {
        closeStream();
        useLiveMetricsStore.setState({ status: 'closed', error: null });
      }
    }, HIDDEN_CLOSE_DELAY_MS);
    return;
  }
  clearTimer(visibilityTimer);
  visibilityTimer = null;
  const state = useLiveMetricsStore.getState();
  if (state.status === 'closed' && state.subscribedIds.size > 0) openStream(state.subscribedIds);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

export const useLiveMetricsStore = create<LiveMetricsState>()((set) => ({
  snapshot: new Map(),
  subscribedIds: new Set(),
  status: 'idle',
  error: null,

  subscribe: (ids) => {
    clearTimer(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      openStream(ids);
    }, SUBSCRIBE_DEBOUNCE_MS);
  },

  unsubscribe: () => {
    clearTimer(debounceTimer);
    debounceTimer = null;
    closeStream();
    set({ snapshot: new Map(), subscribedIds: new Set(), status: 'idle', error: null });
  },

  handleBatch: (batch) => {
    set((state) => {
      const next = new Map(state.snapshot);
      for (const m of batch) next.set(m.metric, m);
      return { snapshot: next };
    });
  },
}));
