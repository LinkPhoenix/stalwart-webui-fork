/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { describe, it, expect } from 'vitest';
import {
  bytesToHuman,
  humanToBytes,
  formatSize,
  msToHuman,
  humanToMs,
  formatDuration,
  SIZE_UNITS,
  DURATION_UNITS,
} from './durationFormat';

describe('SIZE_UNITS', () => {
  it('should contain the expected units in order', () => {
    expect(SIZE_UNITS).toEqual(['B', 'KB', 'MB', 'GB', 'TB']);
  });
});

describe('DURATION_UNITS', () => {
  it('should contain the expected units in order', () => {
    expect(DURATION_UNITS).toEqual(['ms', 's', 'min', 'h', 'd']);
  });
});

describe('bytesToHuman', () => {
  it('should return 0 B for 0 bytes', () => {
    expect(bytesToHuman(0)).toEqual({ value: 0, unit: 'B' });
  });

  it('should keep small values in bytes', () => {
    expect(bytesToHuman(500)).toEqual({ value: 500, unit: 'B' });
  });

  it('should keep 512 bytes as B', () => {
    expect(bytesToHuman(512)).toEqual({ value: 512, unit: 'B' });
  });

  it('should convert 1024 bytes to 1 KB', () => {
    expect(bytesToHuman(1024)).toEqual({ value: 1, unit: 'KB' });
  });

  it('should convert 1536 bytes to 1.5 KB', () => {
    expect(bytesToHuman(1536)).toEqual({ value: 1.5, unit: 'KB' });
  });

  it('should convert 1500 bytes to 1.46 KB', () => {
    expect(bytesToHuman(1500)).toEqual({ value: 1.46, unit: 'KB' });
  });

  it('should convert 1048576 bytes to 1 MB', () => {
    expect(bytesToHuman(1048576)).toEqual({ value: 1, unit: 'MB' });
  });

  it('should convert 10485760 bytes to 10 MB', () => {
    expect(bytesToHuman(10485760)).toEqual({ value: 10, unit: 'MB' });
  });

  it('should convert 1073741824 bytes to 1 GB', () => {
    expect(bytesToHuman(1073741824)).toEqual({ value: 1, unit: 'GB' });
  });

  it('should convert 1099511627776 bytes to 1 TB', () => {
    expect(bytesToHuman(1099511627776)).toEqual({ value: 1, unit: 'TB' });
  });

  it('should format negative byte counts with a minus sign', () => {
    expect(bytesToHuman(-9515272)).toEqual({ value: -9.07, unit: 'MB' });
  });

  it('should treat non-finite byte counts as empty usage', () => {
    expect(bytesToHuman(Number.NaN)).toEqual({ value: 0, unit: 'B' });
    expect(bytesToHuman(Number.POSITIVE_INFINITY)).toEqual({ value: 0, unit: 'B' });
  });
});

describe('humanToBytes', () => {
  it('should convert 1 KB to 1024 bytes', () => {
    expect(humanToBytes(1, 'KB')).toBe(1024);
  });

  it('should convert 10 MB to 10485760 bytes', () => {
    expect(humanToBytes(10, 'MB')).toBe(10485760);
  });

  it('should convert 1.5 GB to 1610612736 bytes', () => {
    expect(humanToBytes(1.5, 'GB')).toBe(1610612736);
  });

  it('should convert 0 B to 0', () => {
    expect(humanToBytes(0, 'B')).toBe(0);
  });

  it('should return the raw value for an unknown unit', () => {
    expect(humanToBytes(42, 'XYZ')).toBe(42);
  });
});

describe('formatSize', () => {
  it('should format 0 bytes as "0 B"', () => {
    expect(formatSize(0)).toBe('0 B');
  });

  it('should format 1024 bytes as "1 KB"', () => {
    expect(formatSize(1024)).toBe('1 KB');
  });

  it('should format 1572864 bytes as "1.5 MB"', () => {
    expect(formatSize(1572864)).toBe('1.5 MB');
  });

  it('should format large values in TB', () => {
    expect(formatSize(1099511627776)).toBe('1 TB');
  });

  it('should format negative byte counts with a minus sign', () => {
    expect(formatSize(-9515272)).toBe('-9.07 MB');
  });
});

describe('msToHuman', () => {
  it('should return 0 ms for 0', () => {
    expect(msToHuman(0)).toEqual({ value: 0, unit: 'ms' });
  });

  it('should keep 500 as ms', () => {
    expect(msToHuman(500)).toEqual({ value: 500, unit: 'ms' });
  });

  it('should convert 1000 ms to 1 s', () => {
    expect(msToHuman(1000)).toEqual({ value: 1, unit: 's' });
  });

  it('should convert 1500 ms to 1.5 s', () => {
    expect(msToHuman(1500)).toEqual({ value: 1.5, unit: 's' });
  });

  it('should convert 60000 ms to 1 min', () => {
    expect(msToHuman(60000)).toEqual({ value: 1, unit: 'min' });
  });

  it('should convert 300000 ms to 5 min', () => {
    expect(msToHuman(300000)).toEqual({ value: 5, unit: 'min' });
  });

  it('should convert 90000 ms to 1.5 min', () => {
    expect(msToHuman(90000)).toEqual({ value: 1.5, unit: 'min' });
  });

  it('should convert 3600000 ms to 1 h', () => {
    expect(msToHuman(3600000)).toEqual({ value: 1, unit: 'h' });
  });

  it('should convert 86400000 ms to 1 d', () => {
    expect(msToHuman(86400000)).toEqual({ value: 1, unit: 'd' });
  });
});

describe('humanToMs', () => {
  it('should convert 5 s to 5000 ms', () => {
    expect(humanToMs(5, 's')).toBe(5000);
  });

  it('should convert 1 min to 60000 ms', () => {
    expect(humanToMs(1, 'min')).toBe(60000);
  });

  it('should convert 2 h to 7200000 ms', () => {
    expect(humanToMs(2, 'h')).toBe(7200000);
  });

  it('should convert 1 d to 86400000 ms', () => {
    expect(humanToMs(1, 'd')).toBe(86400000);
  });

  it('should return the raw value for an unknown unit', () => {
    expect(humanToMs(99, 'eons')).toBe(99);
  });
});

describe('formatDuration', () => {
  it('should format 0 as "0ms"', () => {
    expect(formatDuration(0)).toBe('0ms');
  });

  it('should format 500 ms as "500ms"', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('should format 5000 ms as "5s"', () => {
    expect(formatDuration(5000)).toBe('5s');
  });

  it('should format 65000 ms as "1m 5s"', () => {
    expect(formatDuration(65000)).toBe('1m 5s');
  });

  it('should format 3661000 ms as "1h 1m 1s"', () => {
    expect(formatDuration(3661000)).toBe('1h 1m 1s');
  });

  it('should format 86400000 ms as "1d"', () => {
    expect(formatDuration(86400000)).toBe('1d');
  });

  it('should format 90061500 ms as "1d 1h 1m 1s 500ms"', () => {
    expect(formatDuration(90061500)).toBe('1d 1h 1m 1s 500ms');
  });
});

describe('round-trip: bytes', () => {
  it.each([1024, 1048576, 1073741824, 1099511627776])('bytesToHuman -> humanToBytes should recover %d', (original) => {
    const { value, unit } = bytesToHuman(original);
    expect(humanToBytes(value, unit)).toBe(original);
  });

  it('should be close for non-exact values', () => {
    const original = 123456789;
    const { value, unit } = bytesToHuman(original);
    const recovered = humanToBytes(value, unit);
    expect(Math.abs(recovered - original) / original).toBeLessThan(0.01);
  });
});

describe('round-trip: duration', () => {
  it.each([1000, 60000, 3600000, 86400000])('msToHuman -> humanToMs should recover %d', (original) => {
    const { value, unit } = msToHuman(original);
    expect(humanToMs(value, unit)).toBe(original);
  });

  it('should be close for non-exact values', () => {
    const original = 123456;
    const { value, unit } = msToHuman(original);
    const recovered = humanToMs(value, unit);
    expect(Math.abs(recovered - original) / original).toBeLessThan(0.01);
  });
});
