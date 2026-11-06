/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteLogFilterPreset, listLogFilterPresets, saveLogFilterPreset } from './logFilterPresets';

describe('logFilterPresets', () => {
  beforeEach(() => {
    // Node >= 25 ships an experimental global localStorage that shadows the DOM
    // environment's and is unusable without --localstorage-file; use a plain in-memory store.
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, String(value)),
      removeItem: (key: string) => void data.delete(key),
      clear: () => data.clear(),
    });
  });

  it('saves, lists, replaces same name, and deletes', () => {
    saveLogFilterPreset('Errors', { level: 'error' });
    saveLogFilterPreset('Errors', { level: 'error', event: 'auth' });
    expect(listLogFilterPresets()).toHaveLength(1);
    expect(listLogFilterPresets()[0].filters).toEqual({ level: 'error', event: 'auth' });

    const second = saveLogFilterPreset('Auth', { event: 'auth' });
    expect(listLogFilterPresets()).toHaveLength(2);
    deleteLogFilterPreset(second.id);
    expect(listLogFilterPresets().map((p) => p.name)).toEqual(['Errors']);
  });
});
