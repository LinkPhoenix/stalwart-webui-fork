/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { useState } from 'react';
import { useEventStream } from '@/hooks/useEventStream';
import { appendTraceEvents, buildTracingParams, EMPTY_TRACE_BUFFER, type KeyValueFilter } from '../liveTracing';
import { parseTraceBatch } from '../normalize';
import type { TraceEvent } from '../types';

export function useLiveTracing() {
  const { status, start: startStream, stop, reset: resetStream } = useEventStream<TraceEvent[]>();
  const [buffer, setBuffer] = useState(EMPTY_TRACE_BUFFER);

  const start = (keywords: string, filters: KeyValueFilter[]) => {
    setBuffer(EMPTY_TRACE_BUFFER);
    startStream({
      tokenPath: '/api/token/tracing',
      path: '/api/live/tracing',
      params: buildTracingParams(keywords, filters),
      eventName: 'trace',
      parse: parseTraceBatch,
      onMessage: (batch) => setBuffer((prev) => appendTraceEvents(prev, batch)),
    });
  };

  const reset = () => {
    resetStream();
    setBuffer(EMPTY_TRACE_BUFFER);
  };

  return { status, buffer, start, stop, reset };
}
