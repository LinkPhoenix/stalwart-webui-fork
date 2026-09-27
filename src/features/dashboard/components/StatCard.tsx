/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useMemo } from 'react';
import { HelpCircle, Info } from 'lucide-react';
import { LineChart, Line } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Card as CardSchema } from '../types/schema';
import type { Metric } from '../types/metrics';
import { cardValue, formatValue, sparklineData, computeDelta } from '../helpers';
import { useLiveMetricsStore } from '../stores/liveMetricsStore';
import { getChartColor } from '@/components/ui/chart';
import { SchemaIcon } from '@/components/common/SchemaIcon';

function LucideIcon({ name, className }: { name: string; className?: string }) {
  return <SchemaIcon name={name} className={className} fallback={HelpCircle} warnUnknown />;
}

interface StatCardProps {
  card: CardSchema;
  historySamples: Metric[];
  historyWindow: { from: Date; to: Date };
}

export function StatCard({ card, historySamples, historyWindow }: StatCardProps) {
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
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <LucideIcon name={card.icon} className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{card.title}</span>
          {card.description && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">{card.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        <div className="mt-2 text-2xl font-bold">{formattedValue}</div>

        {(delta || sparkline) && (
          <div className="mt-1 flex items-center gap-2">
            {delta && (
              <Badge variant="secondary" className="text-xs font-normal text-muted-foreground">
                {delta.direction === 'up'
                  ? `\u2191 ${Math.abs(delta.pct)}%`
                  : delta.direction === 'down'
                    ? `\u2193 ${Math.abs(delta.pct)}%`
                    : '\u2013'}
              </Badge>
            )}
            {sparkline && (
              <LineChart width={64} height={32} data={sparkline}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={getChartColor(0)}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
