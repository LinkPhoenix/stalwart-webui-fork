/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IDLE_STATUS,
  openEventStream,
  type EventStream,
  type EventStreamOptions,
  type StreamStatus,
} from '@/services/sse';

export type StartStreamOptions<T> = Omit<EventStreamOptions<T>, 'onStatus'>;

export interface UseEventStream<T> {
  status: StreamStatus;
  start: (options: StartStreamOptions<T>) => void;
  stop: () => void;
  reset: () => void;
}

export function useEventStream<T>(): UseEventStream<T> {
  const [status, setStatus] = useState<StreamStatus>(IDLE_STATUS);
  const streamRef = useRef<EventStream | null>(null);
  const sessionRef = useRef(0);

  const close = useCallback(() => {
    sessionRef.current++;
    streamRef.current?.stop();
    streamRef.current = null;
  }, []);

  useEffect(() => close, [close]);

  const start = useCallback(
    (options: StartStreamOptions<T>) => {
      close();
      const session = sessionRef.current;
      streamRef.current = openEventStream<T>({
        ...options,
        onStatus: (next) => {
          if (sessionRef.current === session) setStatus(next);
        },
      });
      setStatus(streamRef.current.status);
    },
    [close],
  );

  const stop = useCallback(() => {
    streamRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    close();
    setStatus(IDLE_STATUS);
  }, [close]);

  return { status, start, stop, reset };
}
