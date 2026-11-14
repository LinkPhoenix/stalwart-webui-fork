/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

/**
 * `lucide-react/dynamic.js` bundles every icon (~900 kB), so it must never be
 * imported statically: this loader keeps it in a separate lazy chunk that is
 * only fetched when a component actually needs the full dynamic icon set.
 */
let cached: Promise<typeof import('lucide-react/dynamic.js')> | null = null;

export function loadLucideDynamic(): Promise<typeof import('lucide-react/dynamic.js')> {
  cached ??= import('lucide-react/dynamic.js');
  return cached;
}
