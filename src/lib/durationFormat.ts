/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

export const SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

const SIZE_FACTORS: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
};

export function bytesToHuman(bytes: number): { value: number; unit: string } {
  if (!Number.isFinite(bytes) || bytes === 0) return { value: 0, unit: 'B' };

  const sign = bytes < 0 ? -1 : 1;
  const abs = Math.abs(bytes);

  for (let i = SIZE_UNITS.length - 1; i >= 0; i--) {
    const unit = SIZE_UNITS[i];
    const factor = SIZE_FACTORS[unit];
    const v = abs / factor;
    if (v >= 1) {
      const rounded = Math.round(v * 100) / 100;
      return { value: sign * rounded, unit };
    }
  }

  return { value: bytes, unit: 'B' };
}

export function humanToBytes(value: number, unit: string): number {
  const factor = SIZE_FACTORS[unit];
  if (factor === undefined) return value;
  return Math.round(value * factor);
}

export function formatSize(bytes: number): string {
  const { value, unit } = bytesToHuman(bytes);
  return `${value} ${unit}`;
}

export const DURATION_UNITS = ['ms', 's', 'min', 'h', 'd'] as const;

const DURATION_FACTORS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  min: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function msToHuman(ms: number): { value: number; unit: string } {
  if (ms === 0) return { value: 0, unit: 'ms' };

  for (let i = DURATION_UNITS.length - 1; i >= 0; i--) {
    const unit = DURATION_UNITS[i];
    const factor = DURATION_FACTORS[unit];
    const v = ms / factor;
    if (v >= 1) {
      const rounded = Math.round(v * 100) / 100;
      return { value: rounded, unit };
    }
  }

  return { value: ms, unit: 'ms' };
}

export function humanToMs(value: number, unit: string): number {
  const factor = DURATION_FACTORS[unit];
  if (factor === undefined) return value;
  return Math.round(value * factor);
}

export function formatDuration(ms: number): string {
  if (ms === 0) return '0ms';

  const d = Math.floor(ms / 86_400_000);
  ms %= 86_400_000;
  const h = Math.floor(ms / 3_600_000);
  ms %= 3_600_000;
  const m = Math.floor(ms / 60_000);
  ms %= 60_000;
  const s = Math.floor(ms / 1_000);
  ms %= 1_000;

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0) parts.push(`${s}s`);
  if (ms > 0) parts.push(`${ms}ms`);

  return parts.join(' ');
}
