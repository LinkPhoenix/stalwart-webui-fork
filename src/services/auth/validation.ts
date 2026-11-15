/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import i18n from '@/i18n';

export interface DiscoveryResponse {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
  scopes_supported?: string[];
  client_id_metadata_document_supported?: boolean;
  stalwart_required_scopes?: string[];
  protected_resources?: string[];
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;
}

/**
 * Returns the endpoint unchanged when the browser can safely send the user or a token there, `null` otherwise.
 * Relative endpoints are legitimate (Stalwart answers with paths such as `/login`), so the value is resolved
 * the way the browser will resolve it, against the page's base URL.
 *
 * Only `http:` and `https:` are accepted, which rules out `javascript:` and `data:` URLs that would run in
 * the page when assigned to `window.location`. An HTTPS page is never sent to a plain-HTTP endpoint, so a
 * tampered discovery answer cannot downgrade the sign-in; a page already served over HTTP (a private network
 * install) keeps working.
 */
export function safeEndpoint(value: unknown, base: string = document.baseURI): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  let page: URL;
  let endpoint: URL;
  try {
    page = new URL(base);
    endpoint = new URL(value, page);
  } catch {
    return null;
  }
  if (endpoint.protocol !== 'https:' && endpoint.protocol !== 'http:') return null;
  if (page.protocol === 'https:' && endpoint.protocol === 'http:') return null;
  return value;
}

/** Checks the JSON answered by `/api/discover/<user>` before any of it is used to navigate or send a token. */
export function parseDiscovery(data: unknown, base?: string): DiscoveryResponse {
  const authorizationEndpoint = isRecord(data) ? safeEndpoint(data.authorization_endpoint, base) : null;
  const tokenEndpoint = isRecord(data) ? safeEndpoint(data.token_endpoint, base) : null;
  if (!isRecord(data) || !authorizationEndpoint || !tokenEndpoint) {
    throw new Error(
      i18n.t(
        'oauth.invalidDiscovery',
        'The identity provider returned invalid sign-in endpoints. Please contact your administrator.',
      ),
    );
  }

  const discovery: DiscoveryResponse = {
    authorization_endpoint: authorizationEndpoint,
    token_endpoint: tokenEndpoint,
  };
  // Signing out of the identity provider is optional: an unusable endpoint is dropped rather than blocking sign-in.
  const endSessionEndpoint = safeEndpoint(data.end_session_endpoint, base);
  if (endSessionEndpoint) discovery.end_session_endpoint = endSessionEndpoint;
  const scopesSupported = stringArray(data.scopes_supported);
  if (scopesSupported) discovery.scopes_supported = scopesSupported;
  const requiredScopes = stringArray(data.stalwart_required_scopes);
  if (requiredScopes) discovery.stalwart_required_scopes = requiredScopes;
  const protectedResources = stringArray(data.protected_resources);
  if (protectedResources) discovery.protected_resources = protectedResources;
  if (typeof data.client_id_metadata_document_supported === 'boolean') {
    discovery.client_id_metadata_document_supported = data.client_id_metadata_document_supported;
  }
  return discovery;
}

/** Checks a token endpoint answer (code exchange or refresh) before the tokens are stored. */
export function parseTokenResponse(data: unknown): TokenResponse {
  if (!isRecord(data) || typeof data.access_token !== 'string' || data.access_token.length === 0) {
    throw new Error(i18n.t('oauth.invalidTokenResponse', 'The identity provider returned an invalid token response.'));
  }
  const token: TokenResponse = {
    access_token: data.access_token,
    token_type: typeof data.token_type === 'string' ? data.token_type : 'Bearer',
  };
  if (typeof data.refresh_token === 'string' && data.refresh_token.length > 0) {
    token.refresh_token = data.refresh_token;
  }
  if (typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)) {
    token.expires_in = data.expires_in;
  }
  return token;
}
