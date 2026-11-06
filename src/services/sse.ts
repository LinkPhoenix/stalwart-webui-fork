/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { apiFetch, getApiBaseUrl } from '@/services/api';
import { isRetryableError } from '@/services/errors';

export type StreamErrorReason = 'token' | 'rejected' | 'disconnected' | 'timeout';

export class StreamError extends Error {
  readonly reason: StreamErrorReason;

  constructor(reason: StreamErrorReason, cause?: unknown) {
    super(`Event stream ${reason}`, cause === undefined ? undefined : { cause });
    this.name = 'StreamError';
    this.reason = reason;
  }
}

export type StreamStatus =
  | { kind: 'idle' }
  | { kind: 'connecting'; attempt: number }
  | { kind: 'open'; attempt: number }
  | { kind: 'reconnecting'; attempt: number; delayMs: number }
  | { kind: 'closed' }
  | { kind: 'failed'; error: StreamError };

export type StreamAction =
  | { type: 'connect' }
  | { type: 'opened' }
  | { type: 'stable' }
  | { type: 'error'; error: StreamError; retryable: boolean }
  | { type: 'retry' }
  | { type: 'stop' };

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = { maxAttempts: 5, baseDelayMs: 2_000, maxDelayMs: 10_000 };

export const IDLE_STATUS: StreamStatus = { kind: 'idle' };

export const STABLE_AFTER_MS = 30_000;

export function backoffDelay(attempt: number, policy: RetryPolicy): number {
  return Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** Math.max(0, attempt - 1));
}

export function streamTransition(status: StreamStatus, action: StreamAction, policy: RetryPolicy): StreamStatus {
  switch (action.type) {
    case 'connect':
      return { kind: 'connecting', attempt: 0 };
    case 'opened':
      return status.kind === 'connecting' ? { kind: 'open', attempt: status.attempt } : status;
    case 'stable':
      return status.kind === 'open' && status.attempt > 0 ? { kind: 'open', attempt: 0 } : status;
    case 'retry':
      return status.kind === 'reconnecting' ? { kind: 'connecting', attempt: status.attempt } : status;
    case 'stop':
      return status.kind === 'idle' || status.kind === 'closed' || status.kind === 'failed'
        ? status
        : { kind: 'closed' };
    case 'error': {
      if (status.kind !== 'connecting' && status.kind !== 'open' && status.kind !== 'reconnecting') return status;
      const attempt = status.attempt + 1;
      if (action.retryable && attempt <= policy.maxAttempts) {
        return { kind: 'reconnecting', attempt, delayMs: backoffDelay(attempt, policy) };
      }
      return { kind: 'failed', error: action.error };
    }
  }
}

export function isStreamActive(status: StreamStatus): boolean {
  return status.kind === 'connecting' || status.kind === 'open' || status.kind === 'reconnecting';
}

export type StreamParams = Record<string, string | readonly string[] | undefined>;

export function buildStreamUrl(baseUrl: string, path: string, params: StreamParams, token: string): string {
  const search = new URLSearchParams();
  search.set('token', token);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (typeof value === 'string') search.set(key, value);
    else for (const item of value) search.append(key, item);
  }
  return `${baseUrl.replace(/\/+$/, '')}${path}?${search.toString()}`;
}

export function parseJsonBatch<T>(isItem: (value: unknown) => value is T): (data: string) => T[] {
  return (data) => {
    const parsed: unknown = JSON.parse(data);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    if (!items.every(isItem)) throw new TypeError('Unexpected event stream payload');
    return items;
  };
}

export interface EventSourceLike {
  onopen: ((this: EventSource, ev: Event) => unknown) | null;
  onerror: ((this: EventSource, ev: Event) => unknown) | null;
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  close(): void;
}

export interface StreamDeps {
  fetchToken: (tokenPath: string) => Promise<string>;
  createEventSource: (url: string) => EventSourceLike;
  baseUrl: () => string;
}

async function fetchStreamToken(tokenPath: string): Promise<string> {
  const response = await apiFetch(tokenPath);
  return (await response.text()).trim();
}

const defaultDeps: StreamDeps = {
  fetchToken: fetchStreamToken,
  createEventSource: (url) => new EventSource(url) as unknown as EventSourceLike,
  baseUrl: getApiBaseUrl,
};

export interface EventStreamOptions<T> {
  tokenPath: string;
  path: string;
  params?: StreamParams;
  eventName: string;
  parse: (data: string) => T;
  onMessage: (message: T) => void;
  onStatus?: (status: StreamStatus) => void;
  onParseError?: (error: unknown) => void;
  retry?: Partial<RetryPolicy>;
  timeoutMs?: number;
  deps?: Partial<StreamDeps>;
}

export interface EventStream {
  readonly status: StreamStatus;
  stop(): void;
}

export function openEventStream<T>(options: EventStreamOptions<T>): EventStream {
  const policy: RetryPolicy = { ...DEFAULT_RETRY_POLICY, ...options.retry };
  const deps: StreamDeps = { ...defaultDeps, ...options.deps };
  let status: StreamStatus = IDLE_STATUS;
  let source: EventSourceLike | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  let stableTimer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;

  const clearStableTimer = () => {
    if (stableTimer !== null) clearTimeout(stableTimer);
    stableTimer = null;
  };

  const closeSource = () => {
    clearStableTimer();
    if (!source) return;
    source.onopen = null;
    source.onerror = null;
    source.close();
    source = null;
  };

  const clearTimers = () => {
    if (retryTimer !== null) clearTimeout(retryTimer);
    if (deadlineTimer !== null) clearTimeout(deadlineTimer);
    retryTimer = null;
    deadlineTimer = null;
  };

  const dispatch = (action: StreamAction) => {
    const next = streamTransition(status, action, policy);
    if (next === status) return;
    status = next;
    if (status.kind === 'reconnecting') {
      if (retryTimer !== null) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        retryTimer = null;
        dispatch({ type: 'retry' });
      }, status.delayMs);
    } else if (status.kind === 'connecting') {
      void connect();
    } else if (status.kind === 'failed' || status.kind === 'closed') {
      generation++;
      closeSource();
      clearTimers();
    }
    options.onStatus?.(status);
  };

  const connect = async () => {
    const current = ++generation;
    closeSource();
    let token: string;
    try {
      token = await deps.fetchToken(options.tokenPath);
    } catch (err) {
      if (current !== generation) return;
      dispatch({ type: 'error', error: new StreamError('token', err), retryable: isRetryableError(err) });
      return;
    }
    if (current !== generation) return;

    let es: EventSourceLike;
    try {
      es = deps.createEventSource(buildStreamUrl(deps.baseUrl(), options.path, options.params ?? {}, token));
    } catch (err) {
      dispatch({ type: 'error', error: new StreamError('rejected', err), retryable: false });
      return;
    }
    source = es;
    es.onopen = () => {
      if (source !== es) return;
      dispatch({ type: 'opened' });
      clearStableTimer();
      if (status.kind === 'open' && status.attempt > 0) {
        stableTimer = setTimeout(() => {
          stableTimer = null;
          if (source === es) dispatch({ type: 'stable' });
        }, STABLE_AFTER_MS);
      }
    };
    es.onerror = () => {
      if (source !== es) return;
      closeSource();
      if (status.kind === 'connecting' && status.attempt === 0) {
        dispatch({ type: 'error', error: new StreamError('rejected'), retryable: false });
      } else {
        dispatch({ type: 'error', error: new StreamError('disconnected'), retryable: true });
      }
    };
    es.addEventListener(options.eventName, (event) => {
      if (source !== es) return;
      let message: T;
      try {
        message = options.parse(event.data);
      } catch (err) {
        if (options.onParseError) options.onParseError(err);
        else console.warn('Discarding malformed event stream message', err);
        return;
      }
      if (status.kind === 'open' && status.attempt > 0) {
        clearStableTimer();
        dispatch({ type: 'stable' });
      }
      options.onMessage(message);
    });
  };

  if (options.timeoutMs !== undefined) {
    deadlineTimer = setTimeout(() => {
      deadlineTimer = null;
      closeSource();
      dispatch({ type: 'error', error: new StreamError('timeout'), retryable: false });
    }, options.timeoutMs);
  }
  dispatch({ type: 'connect' });

  return {
    get status() {
      return status;
    },
    stop() {
      dispatch({ type: 'stop' });
    },
  };
}
