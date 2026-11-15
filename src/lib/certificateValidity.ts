/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

/**
 * Shared certificate validity logic, used by both the Overview TLS card
 * (src/features/overview/fetchTotals.ts) and the synthetic Status column on
 * the x:Certificate list (SCHEMA-DEVIATION: certificate-validity-status-column),
 * so both always agree on what "valid", "expiring soon" and "expired" mean.
 */

/** Certificates expiring within this window count as "expiring soon". */
export const CERT_EXPIRING_SOON_MS = 30 * 24 * 60 * 60 * 1000;

export type CertificateValidity = 'valid' | 'expiringSoon' | 'expired';

/**
 * Classifies a certificate from its `notValidAfter` wire property.
 * A missing or unparseable date is treated as expired — same rule the
 * Overview card has always used.
 */
export function certificateValidity(notValidAfter: unknown, now: number = Date.now()): CertificateValidity {
  if (typeof notValidAfter !== 'string') return 'expired';
  const expiry = Date.parse(notValidAfter);
  if (!Number.isFinite(expiry) || expiry <= now) return 'expired';
  if (expiry - now <= CERT_EXPIRING_SOON_MS) return 'expiringSoon';
  return 'valid';
}

/**
 * Expiry timestamp in ms for client-side sorting of the Status column.
 * Missing/unparseable dates sort as -1 (expired) so they come first.
 */
export function certificateExpiryMs(notValidAfter: unknown): number {
  if (typeof notValidAfter !== 'string') return -1;
  const expiry = Date.parse(notValidAfter);
  return Number.isFinite(expiry) ? expiry : -1;
}
