/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

function apiOrigin(apiBaseUrl: string | undefined): string | null {
  if (!apiBaseUrl?.trim()) return null;
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return null;
  }
}

/**
 * Policy embedded in the production `index.html` as a `<meta>` tag.
 *
 * The goal is to stop injected script from running or loading code from elsewhere, because the OAuth tokens live
 * in `sessionStorage`. What each directive allows, and why:
 * - `script-src 'self'`: only the bundled chunks. No inline script, no `eval`.
 * - `style-src 'unsafe-inline'`: React `style` attributes, CodeMirror, Recharts and Radix all inject inline styles.
 * - `img-src data: blob:`: the TOTP QR code is a data URL and the custom logo is a blob URL.
 * - `connect-src https:`: the identity provider's token endpoint is discovered at runtime and may live on any
 *   HTTPS origin, so it cannot be listed here. Same-origin and the configured API origin are always allowed.
 *
 * `frame-ancestors` is ignored in a `<meta>` policy: send it as an HTTP header (see docs/SECURITY_OPERATIONS.md).
 */
export function buildContentSecurityPolicy(apiBaseUrl?: string): string {
  const api = apiOrigin(apiBaseUrl);
  // https: already covers an HTTPS API origin.
  const apiSource = api && !api.startsWith('https:') ? ` ${api}` : '';
  const apiImageSource = api ? ` ${api}` : '';

  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${apiImageSource}`,
    "font-src 'self'",
    `connect-src 'self' https:${apiSource}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
