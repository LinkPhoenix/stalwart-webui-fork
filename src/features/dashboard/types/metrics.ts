/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

export type MetricId = string;

export type Metric =
  | { '@type': 'Counter'; metric: MetricId; count: number; nodeId?: number; timestamp?: string }
  | { '@type': 'Gauge'; metric: MetricId; count: number; nodeId?: number; timestamp?: string }
  | { '@type': 'Histogram'; metric: MetricId; count: number; sum: number; nodeId?: number; timestamp?: string };

export interface ClusterNodeInfo {
  nodeId: number;
  hostname?: string;
}

export type Period = { kind: 'preset'; preset: PresetKey } | { kind: 'custom'; from: Date; to: Date };

export type PresetKey = '24h' | '7d' | '30d' | '90d';

export const PRESET_MS: Record<PresetKey, number> = {
  '24h': 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
  '90d': 90 * 86_400_000,
};

export function presetLabel(t: (key: string, fallback: string) => string, key: PresetKey): string {
  switch (key) {
    case '24h':
      return t('dashboard.preset24h', 'Last 24 hours');
    case '7d':
      return t('dashboard.preset7d', 'Last 7 days');
    case '30d':
      return t('dashboard.preset30d', 'Last 30 days');
    case '90d':
      return t('dashboard.preset90d', 'Last 90 days');
  }
}

export const PRESET_KEYS: PresetKey[] = ['24h', '7d', '30d', '90d'];

export const BUCKET_CONFIG: Record<PresetKey, number> = {
  '24h': 48,
  '7d': 56,
  '30d': 60,
  '90d': 90,
};

export const CUSTOM_BUCKET_COUNT = 60;
export const SPARKLINE_BUCKET_COUNT = 20;
