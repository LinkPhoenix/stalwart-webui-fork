/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_OAUTH_CLIENT_ID: string;
  readonly VITE_ACCESS_TOKEN: string;
  readonly VITE_OAUTH_SCOPES: string;
  readonly VITE_DEBUG_JMAP?: string;
  readonly VITE_DEBUG_FORMS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
