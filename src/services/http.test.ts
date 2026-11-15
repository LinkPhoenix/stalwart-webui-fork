/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { NetworkError } from '@/services/errors';
import { fetchWithTimeout, isTimeoutError, timeoutAsNetworkError, withTimeout } from '@/services/http';

/** A fetch that never answers on its own and rejects with the signal's reason once it aborts, like a browser. */
function hangingFetch(): typeof fetch {
  return (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) return;
      const onAbort = () => reject(signal.reason);
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('withTimeout', () => {
  it('aborts with a TimeoutError once the deadline passes', async () => {
    const signal = withTimeout(undefined, 10);
    await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
    expect(isTimeoutError(signal.reason)).toBe(true);
  });

  it('propagates the caller cancellation before the deadline', () => {
    const controller = new AbortController();
    const signal = withTimeout(controller.signal, 60_000);
    expect(signal.aborted).toBe(false);
    controller.abort();
    expect(signal.aborted).toBe(true);
    expect(isTimeoutError(signal.reason)).toBe(false);
  });
});

describe('fetchWithTimeout', () => {
  it('turns a deadline hit into a retryable NetworkError', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    await expect(fetchWithTimeout('/slow', undefined, 10)).rejects.toBeInstanceOf(NetworkError);
  });

  it('rethrows a cancellation requested by the caller untouched', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const controller = new AbortController();
    const pending = fetchWithTimeout('/slow', { signal: controller.signal }, 60_000);
    controller.abort();
    await expect(pending).rejects.not.toBeInstanceOf(NetworkError);
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('wraps connection failures in a NetworkError that keeps the original message', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    const error = await fetchWithTimeout('/down', undefined, 1_000).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(NetworkError);
    expect((error as NetworkError).message).toBe('Failed to fetch');
  });

  it('returns the response and forwards the request options', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    const response = await fetchWithTimeout('/ok', { method: 'POST' }, 1_000);
    expect(await response.text()).toBe('ok');
    expect(fetchMock).toHaveBeenCalledWith('/ok', expect.objectContaining({ method: 'POST' }));
  });
});

describe('timeoutAsNetworkError', () => {
  it('converts only timeout errors', () => {
    expect(timeoutAsNetworkError(new DOMException('late', 'TimeoutError'))).toBeInstanceOf(NetworkError);
    const syntaxError = new SyntaxError('bad json');
    expect(timeoutAsNetworkError(syntaxError)).toBe(syntaxError);
  });
});
