/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { isLinkAccessible } from './layout';
import type { Layout, Schema } from '@/types/schema';

type CanGet = (prefix: string) => boolean;
type HasPermission = (permission: string) => boolean;

const STORAGE_KEY = 'stalwart-last-visited';

// Stores the last visited view name for a given top-level section in localStorage.
export function setLastVisitedSection(section: string, viewName: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    data[section] = viewName;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors (e.g. private mode).
  }
}

// Retrieves the last visited view name for a section, or null if none is stored.
export function getLastVisitedSection(section: string): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, string>;
    return data[section] ?? null;
  } catch {
    return null;
  }
}

// Returns the stored view name only if it is still accessible in the target layout.
export function findLastVisitedLinkInLayout(
  schema: Schema,
  layout: Layout,
  edition: string,
  canGet: CanGet,
  hasPermission: HasPermission,
): string | null {
  const last = getLastVisitedSection(layout.name);
  if (!last) return null;
  if (isLinkAccessible(schema, last, edition, canGet, hasPermission)) return last;
  return null;
}