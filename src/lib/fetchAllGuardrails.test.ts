/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { describe, expect, it } from 'vitest';
import { FETCH_ALL_HARD_CAP, FETCH_ALL_WARN_THRESHOLD, evaluateFetchAllTotal } from './fetchAllGuardrails';

describe('evaluateFetchAllTotal', () => {
  it('allows small totals without warning', () => {
    expect(evaluateFetchAllTotal(0)).toEqual({ ok: true, total: 0, warn: false });
    expect(evaluateFetchAllTotal(FETCH_ALL_WARN_THRESHOLD)).toEqual({
      ok: true,
      total: FETCH_ALL_WARN_THRESHOLD,
      warn: false,
    });
  });

  it('warns above the soft threshold', () => {
    expect(evaluateFetchAllTotal(FETCH_ALL_WARN_THRESHOLD + 1)).toEqual({
      ok: true,
      total: FETCH_ALL_WARN_THRESHOLD + 1,
      warn: true,
    });
  });

  it('hard-fails above the cap', () => {
    expect(evaluateFetchAllTotal(FETCH_ALL_HARD_CAP + 1)).toEqual({
      ok: false,
      total: FETCH_ALL_HARD_CAP + 1,
      reason: 'hard-cap',
    });
  });
});
