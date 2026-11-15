/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { toBase64Url } from '@/lib/base64Url';

export const SIEVEPAD_URL = 'https://sievepad.com/';

const SIEVEPAD_FORMAT_VERSION = 1;
const SIEVEPAD_MAX_NAME_LENGTH = 80;
const SIEVEPAD_MAIN_SCRIPT = 'main';
const WARNING_DISMISSED_KEY = 'stalwart-sievepad-warning-dismissed';

export async function sievepadLink(name: string, source: string, base = SIEVEPAD_URL): Promise<string> {
  const json = JSON.stringify({
    v: SIEVEPAD_FORMAT_VERSION,
    name: name.slice(0, SIEVEPAD_MAX_NAME_LENGTH),
    scripts: [{ name: SIEVEPAD_MAIN_SCRIPT, source: source.replace(/\r\n/g, '\n') }],
    messages: [],
    settings: {},
  });
  const stream = new Blob([new TextEncoder().encode(json)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const packed = new Uint8Array(await new Response(stream).arrayBuffer());
  return `${base}#w=${toBase64Url(packed)}`;
}

export async function openInSievepad(name: string, source: string): Promise<void> {
  const tab = window.open('about:blank', '_blank');
  if (tab) tab.opener = null;
  let link: string;
  try {
    link = await sievepadLink(name, source);
  } catch (err) {
    tab?.close();
    throw err;
  }
  if (tab) {
    tab.location.replace(link);
  } else {
    window.open(link, '_blank', 'noopener,noreferrer');
  }
}

export function isSievepadWarningDismissed(): boolean {
  try {
    return localStorage.getItem(WARNING_DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function dismissSievepadWarning(): void {
  try {
    localStorage.setItem(WARNING_DISMISSED_KEY, 'true');
  } catch {
    return;
  }
}
