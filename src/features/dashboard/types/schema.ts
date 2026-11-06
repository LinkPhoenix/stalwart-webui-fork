/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

export type Dashboard = {
  id: string;
  label: string;
  cards?: Card[];
  charts?: Chart[];
  items?: DashboardItem[];
};

export type Tone = 'flat' | 'accent' | 'ink';

export type Placement = {
  span?: number;
  rows?: number;
  tone?: Tone;
};

export type DashboardItem = Placement &
  (
    | ({ type: 'stat' } & Card)
    | ({ type: 'chart' } & Chart)
    | ({ type: 'headline' } & Headline)
    | ({ type: 'ranking' } & Ranking)
  );

export type Headline = {
  title: string;
  icon?: string;
  numerator: string[];
  denominator: string[];
  aggregate?: Aggregate;
  scope?: MetricScope;
  description?: string;
};

export type Ranking = {
  title: string;
  icon?: string;
  series: Series[];
  valueFormat?: MetricFormat;
  description?: string;
};

export type Card = {
  title: string;
  icon: string;
  source: CardSource;
  metrics: string[];
  aggregate?: Aggregate;
  scope?: MetricScope;
  format: MetricFormat;
  description?: string;
  sparkline?: boolean;
  delta?: boolean;
  polarity?: Polarity;
};

export type Chart = {
  title: string;
  kind: ChartKind;
  series: Series[];
  stacked?: boolean;
  valueFormat?: MetricFormat;
  description?: string;
};

export type Series = {
  label: string;
  metrics: string[];
  aggregate?: Aggregate;
  scope?: MetricScope;
};

export type Aggregate = 'sum' | 'avg' | 'last';
export type Polarity = 'higherIsBetter' | 'lowerIsBetter' | 'neutral';
export type MetricScope = 'node' | 'cluster';
export type ChartKind = 'line' | 'area' | 'bar';
export type CardSource = 'live' | 'history';
export type MetricFormat = 'number' | 'bytes' | 'duration' | 'percent';
