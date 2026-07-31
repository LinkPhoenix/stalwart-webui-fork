/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import {
  findFirstAccessibleLinkInLayout,
  findFirstVisibleLinkInLayout,
  isLinkAccessible,
  type CanGet,
  type HasPermission,
} from '@/lib/layout';
import type { Layout, Schema } from '@/types/schema';

const STORAGE_KEY = 'stalwart-last-visited';

function readAll(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function rememberLastVisited(section: string, viewName: string): void {
  try {
    const all = readAll();
    if (all[section] === viewName) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...all, [section]: viewName }));
  } catch {
    return;
  }
}

export function sectionLandingLink(
  schema: Schema,
  layout: Layout,
  edition: string,
  canGet: CanGet,
  hasPerm?: HasPermission,
): string | null {
  const last = readAll()[layout.name];
  if (typeof last === 'string' && isLinkAccessible(schema, last, edition, canGet, hasPerm)) {
    return last;
  }
  return (
    findFirstAccessibleLinkInLayout(schema, layout, edition, canGet, hasPerm) ??
    findFirstVisibleLinkInLayout(schema, layout, edition, canGet, hasPerm)
  );
}
