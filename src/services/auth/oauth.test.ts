// @vitest-environment-options {"url": "https://admin.example.test/"}
/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import {
  buildEndSessionUrl,
  clearStoredOAuthData,
  discover,
  exchangeCode,
  generateCodeChallenge,
  generateCodeVerifier,
  getStoredOAuthData,
  selectResource,
  selectScopes,
  startAuthFlow,
} from './oauth';

const IDP = 'https://sso.example.test';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** `location.href` assignments navigate for real in happy-dom, so capture them instead. */
function captureNavigation() {
  const navigations: string[] = [];
  const current = window.location;
  vi.stubGlobal('location', {
    origin: current.origin,
    pathname: '/settings/x:Domain',
    search: '?sort=name',
    set href(value: string) {
      navigations.push(value);
    },
    get href() {
      return navigations.at(-1) ?? current.href;
    },
  });
  return navigations;
}

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
  useAuthStore.getState().logout();
});

describe('generateCodeVerifier', () => {
  it('produces 64 unreserved characters by default and a different value each time', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{64}$/);
    expect(generateCodeVerifier()).not.toBe(verifier);
  });

  it('accepts the 43 to 128 character range from RFC 7636 and nothing else', () => {
    expect(generateCodeVerifier(43)).toHaveLength(43);
    expect(generateCodeVerifier(128)).toHaveLength(128);
    expect(() => generateCodeVerifier(42)).toThrow();
    expect(() => generateCodeVerifier(129)).toThrow();
  });
});

describe('generateCodeChallenge', () => {
  it('matches the S256 test vector of RFC 7636 appendix B', async () => {
    const { challenge, method } = await generateCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    expect(method).toBe('S256');
  });
});

describe('selectScopes', () => {
  it('lets an explicit override win over everything the server says', () => {
    expect(selectScopes({ stalwart_required_scopes: ['a'] }, '  custom scope  ', ['extra'])).toBe('custom scope');
  });

  it('asks for the scopes the server requires, plus the page extras without duplicates', () => {
    expect(selectScopes({ stalwart_required_scopes: ['a', 'b'] }, undefined, ['b', 'c'])).toBe('a b c');
  });

  it('falls back to openid when the server lists it as supported', () => {
    expect(selectScopes({ scopes_supported: ['openid', 'email'] }, undefined, [])).toBe('openid');
    expect(selectScopes({ scopes_supported: ['email'] }, undefined, [])).toBe('');
  });

  it('ignores required scopes that are not non-empty strings', () => {
    expect(selectScopes({ stalwart_required_scopes: ['a', '', 7 as unknown as string] }, undefined, [])).toBe('a');
  });
});

describe('selectResource', () => {
  it('uses the API origin, never its path', () => {
    expect(selectResource('https://mail.example.test/jmap', {})).toBe('https://mail.example.test');
  });

  it('is not sent over plain HTTP or for an unusable URL', () => {
    expect(selectResource('http://mail.example.test', {})).toBeNull();
    expect(selectResource('not a url', {})).toBeNull();
  });

  it('is left out when the server lists protected resources and this origin is not one of them', () => {
    expect(selectResource('https://mail.example.test', { protected_resources: ['https://other.test'] })).toBeNull();
    expect(selectResource('https://mail.example.test', { protected_resources: ['https://mail.example.test'] })).toBe(
      'https://mail.example.test',
    );
  });
});

describe('discover', () => {
  it('asks the server about the account name, encoded', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ authorization_endpoint: '/login', token_endpoint: '/token' }));
    vi.stubGlobal('fetch', fetchMock);

    await discover('admin@example.test');

    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/discover\/admin%40example\.test$/);
  });

  it('reports the status when the server cannot answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404, statusText: 'Not Found' })));

    await expect(discover('nobody')).rejects.toThrow(/Discovery failed for "nobody": 404/);
  });
});

describe('startAuthFlow', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({
          authorization_endpoint: `${IDP}/login/oauth/authorize?organization=acme`,
          token_endpoint: `${IDP}/token`,
          end_session_endpoint: `${IDP}/logout`,
          scopes_supported: ['openid'],
          client_id_metadata_document_supported: true,
        }),
      ),
    );
  });

  it('sends the browser to the provider with PKCE and state, keeping the provider query', async () => {
    const navigations = captureNavigation();

    await startAuthFlow('admin@example.test');

    const target = new URL(navigations[0]);
    expect(`${target.origin}${target.pathname}`).toBe(`${IDP}/login/oauth/authorize`);
    expect(target.searchParams.get('organization')).toBe('acme');
    expect(Object.fromEntries(target.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: 'https://admin.example.test/oauth-client.json',
      redirect_uri: 'https://admin.example.test/oauth/callback',
      code_challenge_method: 'S256',
      login_hint: 'admin@example.test',
      prompt: 'login',
      scope: 'openid',
    });
    expect(target.searchParams.get('state')).toMatch(/^[0-9a-f]{32}$/);
  });

  it('keeps what the callback needs, and the challenge belongs to the stored verifier', async () => {
    const navigations = captureNavigation();

    await startAuthFlow('admin@example.test');

    const stored = getStoredOAuthData();
    const target = new URL(navigations[0]);
    expect(stored).toMatchObject({
      tokenEndpoint: `${IDP}/token`,
      endSessionEndpoint: `${IDP}/logout`,
      clientId: 'https://admin.example.test/oauth-client.json',
      returnUrl: '/settings/x:Domain?sort=name',
      state: target.searchParams.get('state'),
    });
    expect((await generateCodeChallenge(stored.codeVerifier!)).challenge).toBe(
      target.searchParams.get('code_challenge'),
    );
  });

  it('does not come back to the sign-in or callback routes afterwards', async () => {
    captureNavigation();

    await startAuthFlow('admin@example.test', '/login?returnUrl=%2Fx');

    expect(getStoredOAuthData().returnUrl).toBe('');
  });

  it('refuses to start when the provider answer is unusable, leaving nothing stored', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ authorization_endpoint: 'javascript:alert(1)' })));
    const navigations = captureNavigation();

    await expect(startAuthFlow('admin@example.test')).rejects.toThrow(/invalid sign-in endpoints/);

    expect(navigations).toEqual([]);
    expect(getStoredOAuthData().codeVerifier).toBeNull();
  });

  it('refuses to start when no client id can be derived', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ authorization_endpoint: `${IDP}/authorize`, token_endpoint: `${IDP}/token` })),
    );
    const navigations = captureNavigation();

    await expect(startAuthFlow('admin@example.test')).rejects.toThrow(/Sign-in is not configured/);

    expect(navigations).toEqual([]);
  });
});

describe('exchangeCode', () => {
  it('posts the authorization code with the PKCE verifier, never a secret', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ access_token: 'a', refresh_token: 'r', expires_in: 300 }));
    vi.stubGlobal('fetch', fetchMock);

    const tokens = await exchangeCode(
      'code-1',
      'verifier-1',
      `${IDP}/token`,
      'https://admin.example.test/oauth/callback',
      'client-1',
      'https://api.test',
    );

    expect(tokens).toEqual({ access_token: 'a', refresh_token: 'r', expires_in: 300, token_type: 'Bearer' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${IDP}/token`);
    expect(init.method).toBe('POST');
    expect(Object.fromEntries(new URLSearchParams(init.body))).toEqual({
      grant_type: 'authorization_code',
      code: 'code-1',
      code_verifier: 'verifier-1',
      client_id: 'client-1',
      redirect_uri: 'https://admin.example.test/oauth/callback',
      resource: 'https://api.test',
    });
  });

  it('reports the status when the provider refuses the code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 400, statusText: 'Bad Request' })));

    await expect(exchangeCode('c', 'v', `${IDP}/token`, 'https://x.test/cb', 'client', null)).rejects.toThrow(
      /Token exchange failed: 400/,
    );
  });

  it('refuses an answer without an access token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'weird' })));

    await expect(exchangeCode('c', 'v', `${IDP}/token`, 'https://x.test/cb', 'client', null)).rejects.toThrow(
      /invalid token response/,
    );
  });
});

describe('buildEndSessionUrl', () => {
  it('adds the client id and where to return to, after an existing query', () => {
    useAuthStore.getState().setTokens('a', 'r', 3600, `${IDP}/token`, null, 'client-1');

    const url = new URL(buildEndSessionUrl(`${IDP}/logout?tenant=acme`, 'https://admin.example.test/login')!);

    expect(url.searchParams.get('tenant')).toBe('acme');
    expect(url.searchParams.get('client_id')).toBe('client-1');
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe('https://admin.example.test/login');
  });

  it('gives nothing when the client id is unknown', () => {
    expect(buildEndSessionUrl(`${IDP}/logout`, 'https://admin.example.test/login')).toBeNull();
  });
});

describe('clearStoredOAuthData', () => {
  it('removes everything the sign-in stored', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json({
          authorization_endpoint: `${IDP}/authorize`,
          token_endpoint: `${IDP}/token`,
          client_id_metadata_document_supported: true,
        }),
      ),
    );
    captureNavigation();
    await startAuthFlow('admin@example.test');

    clearStoredOAuthData();

    expect(Object.values(getStoredOAuthData()).every((value) => value === null)).toBe(true);
  });
});
