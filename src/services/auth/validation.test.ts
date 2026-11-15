/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { describe, expect, it } from 'vitest';
import { parseDiscovery, parseTokenResponse, safeEndpoint } from './validation';

const HTTPS_PAGE = 'https://admin.example.test/';
const HTTP_PAGE = 'http://mail.lan:8080/';

describe('safeEndpoint', () => {
  it('keeps relative paths exactly as given, resolved against the page', () => {
    expect(safeEndpoint('/login', HTTPS_PAGE)).toBe('/login');
    expect(safeEndpoint('/auth/token', HTTP_PAGE)).toBe('/auth/token');
  });

  it('accepts an HTTPS endpoint on another origin, query included', () => {
    const casdoor = 'https://sso.example.test/login/oauth/authorize?organization=acme';
    expect(safeEndpoint(casdoor, HTTPS_PAGE)).toBe(casdoor);
  });

  it.each(['javascript:alert(1)', 'data:text/html,<script>1</script>', 'file:///etc/passwd', 'ftp://host/x'])(
    'rejects the non-HTTP scheme in %s',
    (value) => {
      expect(safeEndpoint(value, HTTPS_PAGE)).toBeNull();
    },
  );

  it('never sends an HTTPS page to a plain-HTTP endpoint', () => {
    expect(safeEndpoint('http://sso.example.test/authorize', HTTPS_PAGE)).toBeNull();
  });

  it('still allows plain HTTP from a page served over plain HTTP', () => {
    expect(safeEndpoint('http://sso.lan/authorize', HTTP_PAGE)).toBe('http://sso.lan/authorize');
  });

  it.each([undefined, null, 42, '', {}, ['/login']])('rejects the non-string or empty value %j', (value) => {
    expect(safeEndpoint(value, HTTPS_PAGE)).toBeNull();
  });
});

describe('parseDiscovery', () => {
  const valid = {
    authorization_endpoint: '/login',
    token_endpoint: '/auth/token',
    end_session_endpoint: '/auth/logout',
    scopes_supported: ['openid', 'offline_access'],
    stalwart_required_scopes: ['urn:stalwart:oauth:scope:full'],
    protected_resources: ['https://admin.example.test'],
    client_id_metadata_document_supported: true,
  };

  it('returns a complete, valid answer', () => {
    expect(parseDiscovery(valid, HTTPS_PAGE)).toEqual(valid);
  });

  it('requires authorization and token endpoints', () => {
    expect(() => parseDiscovery({ ...valid, authorization_endpoint: undefined }, HTTPS_PAGE)).toThrow();
    expect(() => parseDiscovery({ ...valid, token_endpoint: '' }, HTTPS_PAGE)).toThrow();
  });

  it('refuses a tampered endpoint that would run code or downgrade to HTTP', () => {
    expect(() => parseDiscovery({ ...valid, authorization_endpoint: 'javascript:alert(1)' }, HTTPS_PAGE)).toThrow();
    expect(() => parseDiscovery({ ...valid, token_endpoint: 'http://evil.example.test/token' }, HTTPS_PAGE)).toThrow();
  });

  it.each([null, undefined, 'text', 42, [], '<html>Bad gateway</html>'])(
    'refuses the non-object answer %j',
    (value) => {
      expect(() => parseDiscovery(value, HTTPS_PAGE)).toThrow();
    },
  );

  it('drops an unusable end-session endpoint instead of blocking sign-in', () => {
    const result = parseDiscovery({ ...valid, end_session_endpoint: 'javascript:alert(1)' }, HTTPS_PAGE);
    expect(result).not.toHaveProperty('end_session_endpoint');
    expect(result.authorization_endpoint).toBe('/login');
  });

  it('keeps only well-formed optional fields', () => {
    const result = parseDiscovery(
      {
        authorization_endpoint: '/login',
        token_endpoint: '/auth/token',
        scopes_supported: ['openid', 7, null],
        stalwart_required_scopes: 'not-an-array',
        client_id_metadata_document_supported: 'yes',
      },
      HTTPS_PAGE,
    );
    expect(result).toEqual({
      authorization_endpoint: '/login',
      token_endpoint: '/auth/token',
      scopes_supported: ['openid'],
    });
  });
});

describe('parseTokenResponse', () => {
  it('returns the fields used by the application', () => {
    expect(
      parseTokenResponse({ access_token: 'a', refresh_token: 'r', expires_in: 3600, token_type: 'Bearer', extra: 1 }),
    ).toEqual({ access_token: 'a', refresh_token: 'r', expires_in: 3600, token_type: 'Bearer' });
  });

  it('defaults the token type and leaves out optional fields that are absent', () => {
    expect(parseTokenResponse({ access_token: 'a' })).toEqual({ access_token: 'a', token_type: 'Bearer' });
  });

  it('ignores a refresh token or lifetime of the wrong type', () => {
    expect(parseTokenResponse({ access_token: 'a', refresh_token: '', expires_in: '3600' })).toEqual({
      access_token: 'a',
      token_type: 'Bearer',
    });
    expect(parseTokenResponse({ access_token: 'a', expires_in: Number.POSITIVE_INFINITY })).not.toHaveProperty(
      'expires_in',
    );
  });

  it.each([null, undefined, 'token', [], {}, { access_token: '' }, { access_token: 42 }])(
    'refuses the answer %j that has no usable access token',
    (value) => {
      expect(() => parseTokenResponse(value)).toThrow();
    },
  );
});
