/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { describe, expect, it } from 'vitest';
import { compareVersions, isUpdateAvailable, normalizeVersion } from './versionCompare';

describe('normalizeVersion', () => {
  it('strips a leading v prefix and whitespace', () => {
    expect(normalizeVersion('v1.2.3')).toBe('1.2.3');
    expect(normalizeVersion('V2.0')).toBe('2.0');
    expect(normalizeVersion(' 1.0.6 ')).toBe('1.0.6');
  });
});

describe('compareVersions', () => {
  it('orders dotted numeric versions', () => {
    expect(compareVersions('v1.0.7', '1.0.6')).toBeGreaterThan(0);
    expect(compareVersions('1.0.6', 'v1.0.7')).toBeLessThan(0);
    expect(compareVersions('1.2.0', '1.2')).toBe(0);
  });

  it('returns null for unparsable versions', () => {
    expect(compareVersions('nightly', '1.0.6')).toBeNull();
  });
});

describe('isUpdateAvailable', () => {
  it('is false when latest equals current', () => {
    expect(isUpdateAvailable('v1.0.6', '1.0.6')).toBe(false);
  });

  it('is true when latest is newer', () => {
    expect(isUpdateAvailable('v1.1.0', '1.0.6')).toBe(true);
  });

  it('is false when latest is older', () => {
    expect(isUpdateAvailable('v1.0.5', '1.0.6')).toBe(false);
  });

  it('falls back to string difference for unparsable tags', () => {
    expect(isUpdateAvailable('nightly-2', '1.0.6')).toBe(true);
    expect(isUpdateAvailable('v1.0.6', '1.0.6-beta')).toBe(true);
  });
});
