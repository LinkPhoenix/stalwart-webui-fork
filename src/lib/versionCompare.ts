/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '');
}

// Compares two dotted numeric versions; returns null when either is unparsable.
export function compareVersions(a: string, b: string): number | null {
  const pa = normalizeVersion(a).split('.').map(Number);
  const pb = normalizeVersion(b).split('.').map(Number);
  if (pa.some(Number.isNaN) || pb.some(Number.isNaN)) return null;
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// Falls back to a string difference when the versions are not dotted numerics,
// so an unexpected tag format still surfaces as an available update.
export function isUpdateAvailable(latestVersion: string, currentVersion: string): boolean {
  const cmp = compareVersions(latestVersion, currentVersion);
  if (cmp === null) return normalizeVersion(latestVersion) !== normalizeVersion(currentVersion);
  return cmp > 0;
}
