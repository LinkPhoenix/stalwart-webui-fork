/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { getApiBaseUrl } from '@/services/api';

export type LogoSnapshot = { status: 'loading' } | { status: 'custom'; url: string } | { status: 'default' };

let snapshot: LogoSnapshot = { status: 'loading' };
let objectUrl: string | null = null;
let abortController: AbortController | null = null;
let started = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function revokeObjectUrl(): void {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}

export function getLogoSnapshot(): LogoSnapshot {
  return snapshot;
}

export function subscribeLogo(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Starts a single shared /logo fetch. Safe to call from every Logo mount. */
export function ensureLogoLoaded(): void {
  if (started) return;
  started = true;
  snapshot = { status: 'loading' };
  emit();

  abortController?.abort();
  abortController = new AbortController();
  const { signal } = abortController;

  fetch(`${getApiBaseUrl()}/logo`, { signal })
    .then(async (response) => {
      const contentType = response.headers.get('content-type') ?? '';
      if (response.ok && contentType.startsWith('image/')) {
        const blob = await response.blob();
        if (signal.aborted) return;
        revokeObjectUrl();
        objectUrl = URL.createObjectURL(blob);
        snapshot = { status: 'custom', url: objectUrl };
        emit();
        return;
      }
      if (signal.aborted) return;
      snapshot = { status: 'default' };
      emit();
    })
    .catch(() => {
      if (signal.aborted) return;
      snapshot = { status: 'default' };
      emit();
    });
}
