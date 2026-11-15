/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, apiFetchJson } from '@/services/api';
import { ApiError, NetworkError } from '@/services/errors';
import { useAuthStore } from '@/stores/authStore';

const TOKEN_ENDPOINT = 'https://idp.example.test/token';

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Stubs fetch: the handler gets every request, and the calls are recorded for assertions. */
function stubFetch(handler: Handler) {
  const mock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(String(input), init ?? {})),
  );
  vi.stubGlobal('fetch', mock);
  return {
    apiCalls: () => mock.mock.calls.filter(([url]) => String(url) !== TOKEN_ENDPOINT),
    refreshCalls: () => mock.mock.calls.filter(([url]) => String(url) === TOKEN_ENDPOINT),
  };
}

function bearer(init: RequestInit | undefined): string | null {
  return new Headers(init?.headers).get('Authorization');
}

/** `secondsLeft` shortens the remaining life of a token issued for an hour, as if time had passed. */
function signIn(overrides: { refreshToken?: string | null; secondsLeft?: number } = {}) {
  const { refreshToken = 'refresh-1', secondsLeft } = overrides;
  useAuthStore.getState().logout();
  useAuthStore.getState().setTokens('access-1', refreshToken, 3600, TOKEN_ENDPOINT, null, 'client-1', null);
  if (secondsLeft !== undefined) {
    useAuthStore.setState({ tokenExpiresAt: Date.now() + secondsLeft * 1000 });
  }
}

beforeEach(() => {
  signIn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.getState().logout();
});

describe('apiFetch', () => {
  it('sends the access token as a bearer credential', async () => {
    const { apiCalls } = stubFetch(() => json({ ok: true }));

    await apiFetch('/api/account');

    expect(bearer(apiCalls()[0][1])).toBe('Bearer access-1');
  });

  it('turns an error status into an ApiError carrying the problem detail', async () => {
    stubFetch(() => json({ detail: 'Not allowed here' }, 403));

    const error = await apiFetch('/api/x').catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403, detail: 'Not allowed here' });
  });

  it('does not treat an HTML error page as a problem detail', async () => {
    stubFetch(
      () => new Response('<html>Bad gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }),
    );

    const error = await apiFetch('/api/x').catch((err: unknown) => err);

    expect(error).toMatchObject({ status: 502, body: null, detail: null });
  });

  it('turns a connection failure into a retryable NetworkError', async () => {
    stubFetch(() => {
      throw new TypeError('Failed to fetch');
    });

    await expect(apiFetch('/api/x')).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('apiFetchJson', () => {
  it('parses the response body', async () => {
    stubFetch(() => json({ hello: 'world' }));
    expect(await apiFetchJson('/api/x')).toEqual({ hello: 'world' });
  });
});

describe('token refresh after a 401', () => {
  /** Rejects the old access token and accepts the refreshed one. */
  const rotatingServer: Handler = (url, init) => {
    if (url === TOKEN_ENDPOINT) {
      return json({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 3600 });
    }
    return bearer(init) === 'Bearer access-2' ? json({ ok: true }) : json({}, 401);
  };

  it('refreshes once, retries with the new token and keeps the rotated refresh token', async () => {
    const { apiCalls, refreshCalls } = stubFetch(rotatingServer);

    const response = await apiFetch('/api/x');

    expect(response.ok).toBe(true);
    expect(apiCalls().map(([, init]) => bearer(init))).toEqual(['Bearer access-1', 'Bearer access-2']);
    expect(refreshCalls()).toHaveLength(1);
    expect(useAuthStore.getState()).toMatchObject({ accessToken: 'access-2', refreshToken: 'refresh-2' });
  });

  it('sends the refresh grant with the client id and no secret', async () => {
    const { refreshCalls } = stubFetch(rotatingServer);
    useAuthStore
      .getState()
      .setTokens('access-1', 'refresh-1', 3600, TOKEN_ENDPOINT, null, 'client-1', 'https://api.test');

    await apiFetch('/api/x');

    const body = new URLSearchParams(String(refreshCalls()[0][1]?.body));
    expect(Object.fromEntries(body)).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'refresh-1',
      client_id: 'client-1',
      resource: 'https://api.test',
    });
  });

  it('shares one refresh between requests that fail at the same time', async () => {
    const { refreshCalls } = stubFetch(rotatingServer);

    await Promise.all([apiFetch('/api/a'), apiFetch('/api/b'), apiFetch('/api/c')]);

    expect(refreshCalls()).toHaveLength(1);
  });

  it('retries with a token another request already refreshed, without refreshing again', async () => {
    let first = true;
    const { apiCalls, refreshCalls } = stubFetch((url, init) => {
      if (url === TOKEN_ENDPOINT) return json({ access_token: 'unused' });
      if (first) {
        first = false;
        // Another request finishes its refresh while this one is in flight.
        useAuthStore.getState().setTokens('access-2', 'refresh-2', 3600, TOKEN_ENDPOINT);
        return json({}, 401);
      }
      return bearer(init) === 'Bearer access-2' ? json({ ok: true }) : json({}, 401);
    });

    await apiFetch('/api/x');

    expect(refreshCalls()).toHaveLength(0);
    expect(apiCalls().map(([, init]) => bearer(init))).toEqual(['Bearer access-1', 'Bearer access-2']);
  });

  it('ends the session when the retry is rejected as well', async () => {
    stubFetch((url) => (url === TOKEN_ENDPOINT ? json({ access_token: 'access-2' }) : json({}, 401)));

    await expect(apiFetch('/api/x')).rejects.toMatchObject({ status: 401 });

    expect(useAuthStore.getState()).toMatchObject({ accessToken: null, sessionExpired: true });
  });

  it('ends the session when the server rejects the refresh token', async () => {
    stubFetch((url) => (url === TOKEN_ENDPOINT ? json({ error: 'invalid_grant' }, 400) : json({}, 401)));

    await expect(apiFetch('/api/x')).rejects.toBeInstanceOf(ApiError);

    expect(useAuthStore.getState()).toMatchObject({ accessToken: null, refreshToken: null, sessionExpired: true });
  });

  it('keeps the session when the refresh fails only because the network is down', async () => {
    stubFetch((url) => {
      if (url === TOKEN_ENDPOINT) throw new TypeError('Failed to fetch');
      return json({}, 401);
    });

    await expect(apiFetch('/api/x')).rejects.toBeInstanceOf(NetworkError);

    expect(useAuthStore.getState()).toMatchObject({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    expect(useAuthStore.getState().sessionExpired).toBe(false);
  });

  it('does not store a refresh answer that has no access token', async () => {
    stubFetch((url) => (url === TOKEN_ENDPOINT ? json({ unexpected: true }) : json({}, 401)));

    await expect(apiFetch('/api/x')).rejects.toThrow();

    expect(useAuthStore.getState()).toMatchObject({ accessToken: 'access-1', refreshToken: 'refresh-1' });
  });

  it('ends the session at once when there is no refresh token to use', async () => {
    signIn({ refreshToken: null });
    const { refreshCalls } = stubFetch(() => json({}, 401));

    await expect(apiFetch('/api/x')).rejects.toMatchObject({ status: 401 });

    expect(refreshCalls()).toHaveLength(0);
    expect(useAuthStore.getState()).toMatchObject({ accessToken: null, sessionExpired: true });
  });

  it('throws without calling the server when signed out', async () => {
    useAuthStore.getState().logout();
    stubFetch(() => json({}, 401));

    await expect(apiFetch('/api/x')).rejects.toMatchObject({ status: 401 });

    expect(useAuthStore.getState().sessionExpired).toBe(false);
  });

  it('does not overwrite a newer sign-in with a refresh that finishes late', async () => {
    let finishRefresh: (response: Response) => void = () => undefined;
    stubFetch((url) =>
      url === TOKEN_ENDPOINT ? (new Promise<Response>((resolve) => (finishRefresh = resolve)) as never) : json({}, 401),
    );

    const request = apiFetch('/api/x').catch((err: unknown) => err);
    await vi.waitFor(() => expect(finishRefresh).not.toBe(undefined));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    // The user signs in again while the old refresh is still in flight.
    useAuthStore.getState().setTokens('access-new', 'refresh-new', 3600, TOKEN_ENDPOINT);
    finishRefresh(json({ access_token: 'access-stale', refresh_token: 'refresh-stale' }));

    expect(await request).toMatchObject({ status: 401 });
    expect(useAuthStore.getState()).toMatchObject({ accessToken: 'access-new', refreshToken: 'refresh-new' });
  });
});

describe('proactive refresh', () => {
  const freshServer: Handler = (url, init) => {
    if (url === TOKEN_ENDPOINT) return json({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 3600 });
    return json({ token: bearer(init) });
  };

  it('refreshes before the request when the token is about to expire', async () => {
    signIn({ secondsLeft: 10 });
    const { apiCalls, refreshCalls } = stubFetch(freshServer);

    await apiFetch('/api/x');

    expect(refreshCalls()).toHaveLength(1);
    expect(apiCalls()).toHaveLength(1);
    expect(bearer(apiCalls()[0][1])).toBe('Bearer access-2');
  });

  it('does not refresh a token that has plenty of time left', async () => {
    const { refreshCalls } = stubFetch(freshServer);

    await apiFetch('/api/x');

    expect(refreshCalls()).toHaveLength(0);
  });

  it('carries on with the current token if the early refresh fails but the token is still valid', async () => {
    signIn({ secondsLeft: 10 });
    const { apiCalls } = stubFetch((url, init) => {
      if (url === TOKEN_ENDPOINT) throw new TypeError('Failed to fetch');
      return json({ token: bearer(init) });
    });

    await apiFetch('/api/x');

    expect(bearer(apiCalls()[0][1])).toBe('Bearer access-1');
  });
});
