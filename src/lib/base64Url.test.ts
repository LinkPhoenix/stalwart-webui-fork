/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { describe, expect, it } from 'vitest';
import { toBase64Url } from './base64Url';

describe('toBase64Url', () => {
  it('encodes without padding', () => {
    expect(toBase64Url(new TextEncoder().encode('f'))).toBe('Zg');
    expect(toBase64Url(new TextEncoder().encode('fo'))).toBe('Zm8');
    expect(toBase64Url(new TextEncoder().encode('foo'))).toBe('Zm9v');
  });

  it('uses the URL-safe alphabet', () => {
    // 0xfb 0xff 0xfe is "+//+" in standard base64.
    expect(toBase64Url(Uint8Array.from([0xfb, 0xff, 0xfe]))).toBe('-__-');
  });

  it('gives an empty string for no bytes', () => {
    expect(toBase64Url(new Uint8Array())).toBe('');
  });

  it('handles inputs larger than one conversion slice', () => {
    const bytes = new Uint8Array(0x8000 * 3 + 5).fill(0x41);
    expect(atob(toBase64Url(bytes).replace(/-/g, '+').replace(/_/g, '/'))).toBe('A'.repeat(bytes.length));
  });
});
