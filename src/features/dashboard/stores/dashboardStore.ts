/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Period, PresetKey } from '../types/metrics';
import { revivePeriod } from '../helpers';

interface DashboardState {
  period: Period;
  setPeriod: (period: Period) => void;
  setPreset: (preset: PresetKey) => void;
  nodeId: number | null;
  setNodeId: (nodeId: number | null) => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      period: { kind: 'preset', preset: '24h' } as Period,

      setPeriod: (period) => set({ period }),
      setPreset: (preset) => set({ period: { kind: 'preset', preset } }),

      nodeId: null,
      setNodeId: (nodeId) => set({ nodeId }),
    }),
    {
      name: 'dashboard.period',
      partialize: (state) => ({ period: state.period }),
      merge: (persisted, current) => ({
        ...current,
        period: revivePeriod((persisted as { period?: unknown } | undefined)?.period) ?? current.period,
      }),
    },
  ),
);
