/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState } from 'react';
import { useEventStream } from '@/hooks/useEventStream';
import { parseDeliveryBatch, type DeliveryBatch } from '../stages';
import type { DeliveryStage } from '../types';

export const DELIVERY_TRACE_TIMEOUT_MS = 120_000;

export interface DeliveryRun {
  target: string;
  startedAt: number;
  completedAt: number | null;
  stages: DeliveryStage[];
}

export function useDeliveryTrace() {
  const { status, start: startStream, stop, reset: resetStream } = useEventStream<DeliveryBatch>();
  const [run, setRun] = useState<DeliveryRun | null>(null);

  const start = (target: string) => {
    setRun({ target, startedAt: Date.now(), completedAt: null, stages: [] });
    startStream({
      tokenPath: '/api/token/delivery',
      path: `/api/live/delivery/${encodeURIComponent(target)}`,
      eventName: 'event',
      parse: parseDeliveryBatch,
      retry: { maxAttempts: 0 },
      timeoutMs: DELIVERY_TRACE_TIMEOUT_MS,
      onMessage: ({ stages, completed }) => {
        const completedAt = completed ? Date.now() : null;
        setRun((prev) =>
          prev ? { ...prev, stages: prev.stages.concat(stages), completedAt: completedAt ?? prev.completedAt } : prev,
        );
        if (completed) stop();
      },
    });
  };

  const reset = () => {
    resetStream();
    setRun(null);
  };

  return { status, run, start, reset };
}
