/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { NetworkError, isAbortError } from '@/services/errors';

/** Generous because some management actions (reports, mass updates) legitimately run for a while. */
export const API_TIMEOUT_MS = 120_000;
/** Discovery, token exchange and refresh answer from memory or a small lookup: a long wait means a stalled connection. */
export const AUTH_TIMEOUT_MS = 30_000;

/**
 * Combines the caller's cancellation signal with a deadline. `AbortSignal.timeout` also covers reading the
 * response body, so a connection that stalls after the headers cannot hang forever either.
 */
export function withTimeout(signal: AbortSignal | null | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeout;
  // AbortSignal.any is missing from browsers released before 2024: keep the caller's cancellation over the deadline.
  return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : signal;
}

export function isTimeoutError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'TimeoutError';
}

/**
 * Deadline hits and connection failures become a retryable `NetworkError`; a cancellation requested by the
 * caller is rethrown untouched so callers can still tell "cancelled" apart from "failed".
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetch(input, { ...init, signal: withTimeout(init?.signal, timeoutMs) });
  } catch (err) {
    if (isAbortError(err) && !isTimeoutError(err)) throw err;
    throw new NetworkError(err);
  }
}

/** Same conversion for a deadline that expires while the response body is still being read. */
export function timeoutAsNetworkError(err: unknown): unknown {
  return isTimeoutError(err) ? new NetworkError(err) : err;
}
