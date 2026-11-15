/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '@/services/errors';
import {
  DEFAULT_RETRY_POLICY,
  IDLE_STATUS,
  STABLE_AFTER_MS,
  StreamError,
  backoffDelay,
  buildStreamUrl,
  isStreamActive,
  openEventStream,
  parseJsonBatch,
  streamTransition,
  type EventSourceLike,
  type StreamStatus,
} from './sse';

const policy = { maxAttempts: 3, baseDelayMs: 1_000, maxDelayMs: 4_000 };
const rejected = new StreamError('rejected');

describe('backoffDelay', () => {
  it('doubles from the base delay and stops at the maximum', () => {
    expect([1, 2, 3, 4, 5].map((attempt) => backoffDelay(attempt, policy))).toEqual([
      1_000, 2_000, 4_000, 4_000, 4_000,
    ]);
  });

  it('treats attempt zero like the first attempt', () => {
    expect(backoffDelay(0, policy)).toBe(1_000);
  });
});

describe('streamTransition', () => {
  it('starts connecting from any state', () => {
    expect(streamTransition(IDLE_STATUS, { type: 'connect' }, policy)).toEqual({ kind: 'connecting', attempt: 0 });
  });

  it('opens only from connecting', () => {
    expect(streamTransition({ kind: 'connecting', attempt: 2 }, { type: 'opened' }, policy)).toEqual({
      kind: 'open',
      attempt: 2,
    });
    expect(streamTransition(IDLE_STATUS, { type: 'opened' }, policy)).toBe(IDLE_STATUS);
  });

  it('forgets earlier failures once an opened stream is stable', () => {
    expect(streamTransition({ kind: 'open', attempt: 2 }, { type: 'stable' }, policy)).toEqual({
      kind: 'open',
      attempt: 0,
    });
  });

  it('schedules a reconnect with backoff after a retryable error', () => {
    const error = { type: 'error', error: new StreamError('disconnected'), retryable: true } as const;
    expect(streamTransition({ kind: 'open', attempt: 0 }, error, policy)).toEqual({
      kind: 'reconnecting',
      attempt: 1,
      delayMs: 1_000,
    });
    expect(streamTransition({ kind: 'reconnecting', attempt: 1, delayMs: 1_000 }, { type: 'retry' }, policy)).toEqual({
      kind: 'connecting',
      attempt: 1,
    });
  });

  it('gives up after the maximum number of attempts', () => {
    const error = { type: 'error', error: new StreamError('disconnected'), retryable: true } as const;
    const status = streamTransition({ kind: 'connecting', attempt: policy.maxAttempts }, error, policy);
    expect(status).toMatchObject({ kind: 'failed' });
  });

  it('fails at once on an error that retrying cannot fix', () => {
    const status = streamTransition(
      { kind: 'connecting', attempt: 0 },
      { type: 'error', error: rejected, retryable: false },
      policy,
    );
    expect(status).toEqual({ kind: 'failed', error: rejected });
  });

  it('ignores errors once the stream is no longer active', () => {
    const closed: StreamStatus = { kind: 'closed' };
    expect(streamTransition(closed, { type: 'error', error: rejected, retryable: true }, policy)).toBe(closed);
  });

  it('stops an active stream but leaves a finished one as it is', () => {
    expect(streamTransition({ kind: 'open', attempt: 0 }, { type: 'stop' }, policy)).toEqual({ kind: 'closed' });
    const failed: StreamStatus = { kind: 'failed', error: rejected };
    expect(streamTransition(failed, { type: 'stop' }, policy)).toBe(failed);
  });
});

describe('isStreamActive', () => {
  it('is true only while connecting, open or waiting to reconnect', () => {
    expect(isStreamActive({ kind: 'connecting', attempt: 0 })).toBe(true);
    expect(isStreamActive({ kind: 'open', attempt: 0 })).toBe(true);
    expect(isStreamActive({ kind: 'reconnecting', attempt: 1, delayMs: 10 })).toBe(true);
    expect(isStreamActive(IDLE_STATUS)).toBe(false);
    expect(isStreamActive({ kind: 'closed' })).toBe(false);
  });
});

describe('buildStreamUrl', () => {
  it('puts the token first and appends single and repeated parameters', () => {
    const url = new URL(
      buildStreamUrl(
        'https://mail.test/',
        '/api/live',
        { types: ['a', 'b'], level: 'info', skipped: undefined },
        'tok en',
      ),
    );
    expect(`${url.origin}${url.pathname}`).toBe('https://mail.test/api/live');
    expect(url.search.startsWith('?token=tok+en&')).toBe(true);
    expect(url.searchParams.getAll('types')).toEqual(['a', 'b']);
    expect(url.searchParams.get('level')).toBe('info');
    expect(url.searchParams.has('skipped')).toBe(false);
  });
});

describe('parseJsonBatch', () => {
  const isNumber = (value: unknown): value is number => typeof value === 'number';

  it('accepts one item or a list of items', () => {
    expect(parseJsonBatch(isNumber)('1')).toEqual([1]);
    expect(parseJsonBatch(isNumber)('[1,2]')).toEqual([1, 2]);
  });

  it('rejects a payload with an unexpected item or invalid JSON', () => {
    expect(() => parseJsonBatch(isNumber)('[1,"x"]')).toThrow(TypeError);
    expect(() => parseJsonBatch(isNumber)('{oops')).toThrow(SyntaxError);
  });
});

describe('openEventStream', () => {
  class FakeSource implements EventSourceLike {
    onopen: ((this: EventSource, ev: Event) => unknown) | null = null;
    onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
    closed = false;
    private listeners = new Map<string, (event: MessageEvent<string>) => void>();

    readonly url: string;

    constructor(url: string) {
      this.url = url;
    }

    addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
      this.listeners.set(type, listener);
    }

    close() {
      this.closed = true;
    }

    open() {
      this.onopen?.call(undefined as never, new Event('open'));
    }

    fail() {
      this.onerror?.call(undefined as never, new Event('error'));
    }

    emit(type: string, data: string) {
      this.listeners.get(type)?.(new MessageEvent(type, { data }));
    }
  }

  let sources: FakeSource[];
  let fetchToken: ReturnType<typeof vi.fn<(path: string) => Promise<string>>>;
  let messages: number[];
  let statuses: StreamStatus[];

  beforeEach(() => {
    vi.useFakeTimers();
    sources = [];
    messages = [];
    statuses = [];
    fetchToken = vi.fn().mockResolvedValue('stream-token');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function start(extra: Partial<Parameters<typeof openEventStream<number>>[0]> = {}) {
    return openEventStream<number>({
      tokenPath: '/api/token/live',
      path: '/api/live',
      params: { filter: 'x' },
      eventName: 'metrics',
      parse: (data) => Number(data),
      onMessage: (message) => messages.push(message),
      onStatus: (status) => statuses.push(status),
      retry: policy,
      deps: {
        fetchToken,
        baseUrl: () => 'https://mail.test',
        createEventSource: (url) => {
          const source = new FakeSource(url);
          sources.push(source);
          return source;
        },
      },
      ...extra,
    });
  }

  const flush = () => vi.advanceTimersByTimeAsync(0);

  it('fetches a short-lived token, connects with it and delivers messages', async () => {
    const stream = start();
    await flush();

    expect(fetchToken).toHaveBeenCalledWith('/api/token/live');
    expect(sources[0].url).toBe('https://mail.test/api/live?token=stream-token&filter=x');
    sources[0].open();
    sources[0].emit('metrics', '42');

    expect(stream.status).toEqual({ kind: 'open', attempt: 0 });
    expect(messages).toEqual([42]);
  });

  it('discards a malformed message without closing the stream', async () => {
    const onParseError = vi.fn();
    const stream = start({
      parse: (data) => {
        if (data === 'bad') throw new SyntaxError('bad');
        return Number(data);
      },
      onParseError,
    });
    await flush();
    sources[0].open();

    sources[0].emit('metrics', 'bad');
    sources[0].emit('metrics', '7');

    expect(onParseError).toHaveBeenCalledOnce();
    expect(messages).toEqual([7]);
    expect(stream.status.kind).toBe('open');
  });

  it('fails without retrying when the very first connection is refused', async () => {
    const stream = start();
    await flush();

    sources[0].fail();

    expect(stream.status).toMatchObject({ kind: 'failed', error: { reason: 'rejected' } });
    expect(sources[0].closed).toBe(true);
    expect(sources).toHaveLength(1);
  });

  it('reconnects with a fresh token after a connection that was working drops', async () => {
    const stream = start();
    await flush();
    sources[0].open();

    sources[0].fail();
    expect(stream.status).toMatchObject({ kind: 'reconnecting', attempt: 1, delayMs: 1_000 });
    expect(sources[0].closed).toBe(true);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchToken).toHaveBeenCalledTimes(2);
    expect(sources).toHaveLength(2);
    sources[1].open();
    expect(stream.status).toEqual({ kind: 'open', attempt: 1 });
  });

  it('counts a connection as stable after it stays up long enough, so later drops start over', async () => {
    const stream = start();
    await flush();
    sources[0].open();
    sources[0].fail();
    await vi.advanceTimersByTimeAsync(1_000);
    sources[1].open();

    await vi.advanceTimersByTimeAsync(STABLE_AFTER_MS);

    expect(stream.status).toEqual({ kind: 'open', attempt: 0 });
  });

  it('gives up after the maximum number of reconnects', async () => {
    const stream = start();
    await flush();
    sources[0].open();

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      sources.at(-1)!.fail();
      await vi.advanceTimersByTimeAsync(policy.maxDelayMs);
      sources.at(-1)!.open();
    }
    sources.at(-1)!.fail();

    expect(stream.status).toMatchObject({ kind: 'failed', error: { reason: 'disconnected' } });
  });

  it('retries when the token request fails on the network but not when the server refuses it', async () => {
    fetchToken.mockRejectedValueOnce(new NetworkError(new TypeError('offline')));
    const retrying = start();
    await flush();
    expect(retrying.status).toMatchObject({ kind: 'reconnecting', attempt: 1 });
    retrying.stop();

    fetchToken.mockRejectedValueOnce(new ApiError(403, 'Forbidden', null));
    const refused = start();
    await flush();
    expect(refused.status).toMatchObject({ kind: 'failed', error: { reason: 'token' } });
  });

  it('fails with a timeout when the deadline passes first', async () => {
    const stream = start({ timeoutMs: 5_000 });
    await flush();

    await vi.advanceTimersByTimeAsync(5_000);

    expect(stream.status).toMatchObject({ kind: 'failed', error: { reason: 'timeout' } });
    expect(sources[0].closed).toBe(true);
  });

  it('closes the connection and stays quiet once stopped', async () => {
    const stream = start();
    await flush();
    sources[0].open();

    stream.stop();
    sources[0].emit('metrics', '1');
    await vi.advanceTimersByTimeAsync(60_000);

    expect(stream.status).toEqual({ kind: 'closed' });
    expect(sources[0].closed).toBe(true);
    expect(messages).toEqual([]);
    expect(sources).toHaveLength(1);
  });

  it('does not open a connection if stopped while the token was being fetched', async () => {
    let giveToken: (token: string) => void = () => undefined;
    fetchToken.mockReturnValueOnce(new Promise<string>((resolve) => (giveToken = resolve)));
    const stream = start();
    await flush();

    stream.stop();
    giveToken('late-token');
    await flush();

    expect(sources).toHaveLength(0);
  });

  it('uses sensible default retry settings', () => {
    expect(DEFAULT_RETRY_POLICY).toEqual({ maxAttempts: 5, baseDelayMs: 2_000, maxDelayMs: 10_000 });
  });
});
