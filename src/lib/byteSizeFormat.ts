/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { NumberFormat } from '@/types/schema';

/**
 * SCHEMA-DEVIATION: byte-size-number-format (see SCHEMA_DEVIATIONS.md)
 *
 * Property names Stalwart uses for byte quantities. Most schemas already set
 * `format: "size"`; a few (notably queued-message `size`) still advertise
 * `unsignedInteger`, which would render as a bare locale number (e.g. "1,254").
 * Matching by property name keeps this schema-driven rather than per-view.
 */
const BYTE_SIZE_PROPERTY_KEYS = new Set(['size', 'maxsize', 'useddiskquota', 'maxdiskquota']);

export function isByteSizePropertyName(propertyName: string): boolean {
  const key = propertyName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return BYTE_SIZE_PROPERTY_KEYS.has(key);
}

/**
 * Effective number format for display. Promotes integer-like formats to `size`
 * when the property name is a known byte field; never overrides `duration` or
 * an explicit `size` / `float`.
 */
export function effectiveNumberFormat(
  propertyName: string,
  format: NumberFormat | string | undefined,
): NumberFormat | string | undefined {
  if (format === 'size' || format === 'duration' || format === 'float') {
    return format;
  }
  if (
    isByteSizePropertyName(propertyName) &&
    (format === 'integer' || format === 'unsignedInteger' || format == null || format === '')
  ) {
    return 'size';
  }
  return format;
}
