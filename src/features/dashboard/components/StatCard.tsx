/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownRight, ArrowUpRight, HelpCircle, Info, Minus } from 'lucide-react';
import { DynamicIcon } from '@/components/common/DynamicIcon';
import { LineChart, Line } from 'recharts';
import { Card } from '@/components/ui/card';
import { HelpTooltip } from '@/components/common/HelpTooltip';
import type { Card as CardSchema, Placement } from '../types/schema';
import type { Metric } from '../types/metrics';
import { cardValue, deltaSentiment, formatValue, sparklineData, computeDelta } from '../helpers';
import { useLiveMetricsStore } from '../stores/liveMetricsStore';
import { getChartColor } from '@/components/ui/chart';
import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toneClasses } from './tone';

function DeltaBadge({
  pct,
  direction,
  className,
}: {
  pct: number;
  direction: 'up' | 'down' | 'neutral';
  className: string;
}) {
  const { t } = useTranslation();
  const value = formatPercent(Math.abs(pct), Number.isInteger(pct) ? 0 : 1);
  const label =
    direction === 'up'
      ? t('dashboard.deltaUp', 'Up {{value}}', { value })
      : direction === 'down'
        ? t('dashboard.deltaDown', 'Down {{value}}', { value })
        : t('dashboard.deltaNone', 'No change');
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1 rounded-full px-2 text-xs font-semibold tabular-nums',
        className,
      )}
    >
      <span className="sr-only">{label}</span>
      <Icon aria-hidden="true" className="size-3" />
      {direction !== 'neutral' && <span aria-hidden="true">{value}</span>}
    </span>
  );
}

interface StatCardProps {
  card: CardSchema & Placement;
  className?: string;
  historySamples: Metric[];
  historyWindow: { from: Date; to: Date };
}

export function StatCard({ card, className, historySamples, historyWindow }: StatCardProps) {
  const toneClass = toneClasses(card.tone);
  const liveSnapshot = useLiveMetricsStore((s) => s.snapshot);

  const value = useMemo(() => {
    if (card.source === 'live') {
      const liveSamples = card.metrics.map((id) => liveSnapshot.get(id)).filter((m): m is Metric => m !== undefined);
      return cardValue(card, liveSamples);
    }
    return cardValue(card, historySamples);
  }, [card, liveSnapshot, historySamples]);

  const formattedValue = formatValue(value, card.format);

  const { from, to } = historyWindow;

  const sparkline = useMemo(() => {
    if (card.source !== 'history' || !card.sparkline) return null;
    return sparklineData(card, historySamples, from, to).map((v, i) => ({
      v,
      i,
    }));
  }, [card, historySamples, from, to]);

  const delta = useMemo(() => {
    if (card.source !== 'history' || !card.delta) return null;
    return computeDelta(card, historySamples, from, to);
  }, [card, historySamples, from, to]);

  return (
    <Card
      role="group"
      aria-label={card.title}
      className={cn('flex min-h-[148px] flex-col gap-2.5 px-5 pb-4 pt-[18px]', toneClass.surface, className)}
    >
      <div className={cn('flex min-w-0 items-center gap-2.5 text-[13px] font-medium', toneClass.muted)}>
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-[11px]', toneClass.badge)}>
          <DynamicIcon name={card.icon} fallback={HelpCircle} className="size-[17px]" />
        </span>
        <span className="min-w-0 truncate">{card.title}</span>
        {card.description && <HelpTooltip content={card.description} label={card.title} icon={Info} />}
      </div>

      <div
        data-slot="stat-value"
        className="font-display text-[1.75rem] font-bold leading-none tracking-[-0.03em] tabular-nums"
      >
        {formattedValue}
      </div>

      {(delta || sparkline) && (
        <div className="mt-auto flex items-end justify-between gap-3">
          {delta && (
            <DeltaBadge
              pct={delta.pct}
              direction={delta.direction}
              className={toneClass.sentiment[deltaSentiment(delta.direction, card.polarity)]}
            />
          )}
          {sparkline && (
            <LineChart
              className="ml-auto"
              width={120}
              height={36}
              data={sparkline}
              margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
            >
              <Line
                type="monotone"
                dataKey="v"
                stroke={toneClass.accentColor ?? getChartColor(0)}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          )}
        </div>
      )}
    </Card>
  );
}
