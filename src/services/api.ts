/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useAuthStore } from '@/stores/authStore';
import { ApiError, NetworkError, isAbortError } from '@/services/errors';

export { ApiError } from '@/services/errors';

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envUrl && envUrl.length > 0) {
    return envUrl.replace(/\/+$/, '');
  }
  return window.location.origin;
}

let refreshPromise: Promise<void> | null = null;

function expireSession(): ApiError {
  useAuthStore.getState().expireSession();
  return new ApiError(401, 'Unauthorized', null);
}

async function performRefresh(): Promise<void> {
  const { refreshToken, tokenEndpoint, clientId, resource } = useAuthStore.getState();
  if (!refreshToken || !tokenEndpoint || !clientId) {
    throw expireSession();
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });
  if (resource) {
    body.set('resource', resource);
  }

  let response: Response;
  try {
    response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (err) {
    throw new NetworkError(err);
  }

  const stillCurrent = () => useAuthStore.getState().refreshToken === refreshToken;

  if (!response.ok) {
    const body = await readErrorBody(response);
    if ((response.status === 400 || response.status === 401) && stillCurrent()) {
      useAuthStore.getState().expireSession();
    }
    throw new ApiError(response.status, response.statusText, body);
  }

  const data = (await response.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  if (!stillCurrent()) {
    throw new ApiError(401, 'Unauthorized', null);
  }
  useAuthStore
    .getState()
    .setTokens(data.access_token, data.refresh_token ?? refreshToken, data.expires_in ?? Number.NaN, tokenEndpoint);
}

export function refreshAccessToken(): Promise<void> {
  refreshPromise ??= performRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function readErrorBody(response: Response): Promise<unknown> {
  let text: string;
  try {
    text = await response.text();
  } catch (err) {
    return { detail: `Failed to read error response: ${String(err)}` };
  }
  if (text.length === 0) return null;
  if (response.headers.get('Content-Type')?.toLowerCase().includes('html')) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function send(
  path: string,
  options: RequestInit | undefined,
): Promise<{ response: Response; token: string | null }> {
  const { accessToken } = useAuthStore.getState();
  const headers = new Headers(options?.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, { ...options, headers, redirect: 'follow' });
    return { response, token: accessToken };
  } catch (err) {
    if (isAbortError(err)) throw err;
    throw new NetworkError(err);
  }
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const { isTokenExpiringSoon, refreshToken } = useAuthStore.getState();
  if (refreshToken && isTokenExpiringSoon()) {
    try {
      await refreshAccessToken();
    } catch (err) {
      const { accessToken, tokenExpiresAt } = useAuthStore.getState();
      if (!accessToken || (tokenExpiresAt !== null && tokenExpiresAt <= Date.now())) throw err;
    }
  }

  const first = await send(path, options);
  let response = first.response;

  if (response.status === 401) {
    const current = useAuthStore.getState();
    if (!current.accessToken) {
      throw new ApiError(401, 'Unauthorized', null);
    }
    if (current.accessToken === first.token) {
      if (!current.refreshToken) {
        throw expireSession();
      }
      await refreshAccessToken();
      if (!useAuthStore.getState().accessToken) {
        throw new ApiError(401, 'Unauthorized', null);
      }
    }
    response = (await send(path, options)).response;
    if (response.status === 401) {
      throw expireSession();
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText, await readErrorBody(response));
  }

  return response;
}

export async function apiFetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(path, options);
  return (await response.json()) as T;
}
