/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

function problemDetail(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    if (typeof body !== 'string') return null;
    const text = body.trim();
    return text.length > 0 && !text.startsWith('<') ? text : null;
  }
  const obj = body as Record<string, unknown>;
  for (const key of ['detail', 'description', 'title', 'error_description', 'message']) {
    const value = obj[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;
  readonly detail: string | null;

  constructor(status: number, statusText: string, body: unknown) {
    const detail = problemDetail(body);
    super(detail ?? `API error ${status}${statusText ? `: ${statusText}` : ''}`);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    this.detail = detail;
  }

  get problemType(): string | null {
    const type = (this.body as Record<string, unknown> | null)?.type;
    return typeof type === 'string' ? type : null;
  }
}

export class JmapMethodError extends Error {
  readonly type: string;
  readonly description: string | null;
  readonly methodName: string;
  readonly callId: string;
  readonly details: Record<string, unknown>;

  constructor(methodName: string, callId: string, details: Record<string, unknown>) {
    const type = typeof details.type === 'string' ? details.type : 'serverFail';
    const description = typeof details.description === 'string' ? details.description : null;
    super(description ?? `JMAP ${methodName} error: ${type}`);
    this.name = 'JmapMethodError';
    this.type = type;
    this.description = description;
    this.methodName = methodName;
    this.callId = callId;
    this.details = details;
  }
}

export class JmapProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JmapProtocolError';
  }
}

export class NetworkError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error && cause.message ? cause.message : 'Network request failed', { cause });
    this.name = 'NetworkError';
  }
}

export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

export function isRetryableError(err: unknown): boolean {
  if (isAbortError(err)) return false;
  if (err instanceof JmapMethodError) return err.type === 'serverUnavailable';
  if (err instanceof JmapProtocolError) return false;
  if (err instanceof ApiError) return err.status >= 500 || err.status === 408 || err.status === 429;
  return err instanceof NetworkError;
}
