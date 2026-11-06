/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

export interface AdminRoute {
  viewName?: string;
  id?: string;
}

const RESERVED_IDS = new Set(['new', 'singleton']);

export function parseAdminRoute(splat: string | undefined, isView: (viewName: string) => boolean): AdminRoute {
  const parts = (splat ?? '').split('/').filter((part) => part.length > 0);
  if (parts.length === 0) return {};

  const last = parts[parts.length - 1];
  const head = parts.slice(0, -1).join('/');
  if (RESERVED_IDS.has(last) && head) return { viewName: head, id: last };

  const full = parts.join('/');
  if (isView(full) || parts.length === 1) return { viewName: full };
  if (isView(head)) return { viewName: head, id: last };
  return { viewName: full };
}
