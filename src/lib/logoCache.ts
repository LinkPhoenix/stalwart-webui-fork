/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { getApiBaseUrl } from '@/services/api';

export type LogoState = { status: 'loading' } | { status: 'custom'; url: string } | { status: 'default' };

let state: LogoState = { status: 'loading' };
let started = false;
const listeners = new Set<() => void>();

export function getLogoState(): LogoState {
  return state;
}

export function subscribeToLogo(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function loadLogoOnce(): void {
  if (started) return;
  started = true;
  fetch(`${getApiBaseUrl()}/logo`)
    .then(async (response) => {
      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || !contentType.startsWith('image/')) return null;
      return URL.createObjectURL(await response.blob());
    })
    .catch(() => null)
    .then((url) => {
      state = url ? { status: 'custom', url } : { status: 'default' };
      listeners.forEach((notify) => notify());
    });
}
