/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useMemo, useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

function ChartSizedContainer({
  height,
  children,
}: {
  height: number;
  children: (width: number, height: number) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setWidth(w);
      }
    });
    ro.observe(el);
    const w = el.getBoundingClientRect().width;
    if (w > 0) setWidth(w);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ height }}>
      {width > 0 && children(width, height)}
    </div>
  );
}
import { Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getChartColor } from '@/components/ui/chart';
import { ChartTooltipContent } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import type { Chart as ChartSchema } from '../types/schema';
import type { Metric, Period } from '../types/metrics';
import {
  bucketize,
  bucketTimestamps,
  getBucketCount,
  seriesBucketValue,
  formatTimeTick,
  formatValue,
} from '../helpers';

interface DashboardChartProps {
  chart: ChartSchema;
  historySamples: Metric[];
  historyWindow: { from: Date; to: Date };
  period: Period;
}

export function DashboardChart({ chart, historySamples, historyWindow, period }: DashboardChartProps) {
  const { t } = useTranslation();
  const { from, to } = historyWindow;
  const bucketCount = getBucketCount(period);
  const valueFormat = chart.valueFormat ?? 'number';

  const data = useMemo(() => {
    const buckets = bucketize(historySamples, from, to, bucketCount);
    const timestamps = bucketTimestamps(from, to, bucketCount);

    const points = timestamps.map((ts, i) => {
      const point: Record<string, unknown> = {
        time: ts.getTime(),
        timeLabel: formatTimeTick(ts, period),
      };
      for (const series of chart.series) {
        point[series.label] = seriesBucketValue(series, buckets[i]);
      }
      return point;
    });

    if (chart.stacked) {
      const lastSeen: Record<string, number> = {};
      for (const point of points) {
        for (const series of chart.series) {
          const v = point[series.label];
          if (typeof v === 'number') {
            lastSeen[series.label] = v;
          } else {
            point[series.label] = lastSeen[series.label] ?? 0;
          }
        }
      }
    }

    return points;
  }, [historySamples, from, to, bucketCount, chart.series, chart.stacked, period]);

  const tickFormatter = (value: number) => formatValue(value, valueFormat);

  const tooltipFormatter = (value: number) => formatValue(value, valueFormat);

  const renderChart = (chartWidth: number, chartHeight: number) => {
    const commonProps = {
      data,
      width: chartWidth,
      height: chartHeight,
      margin: { top: 5, right: 10, left: 10, bottom: 5 },
    };

    const seriesElements = chart.series.map((s, i) => {
      const color = getChartColor(i);
      const key = s.label;

      switch (chart.kind) {
        case 'line':
          return (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          );
        case 'area':
          return (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={color}
              fill={color}
              fillOpacity={0.3}
              strokeWidth={2}
              stackId={chart.stacked ? '1' : undefined}
              isAnimationActive={false}
              connectNulls
            />
          );
        case 'bar':
          return (
            <Bar
              key={key}
              dataKey={key}
              fill={color}
              stackId={chart.stacked ? '1' : undefined}
              isAnimationActive={false}
            />
          );
      }
    });

    const axes = (
      <>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="timeLabel"
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={tickFormatter}
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
          tickLine={false}
          axisLine={false}
          width={60}
        />
        <Tooltip
          content={({ active, payload, label }) => (
            <ChartTooltipContent
              active={active}
              payload={payload}
              label={label as string}
              formatter={tooltipFormatter}
            />
          )}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
      </>
    );

    switch (chart.kind) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            {axes}
            {seriesElements}
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {axes}
            {seriesElements}
          </AreaChart>
        );
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {axes}
            {seriesElements}
          </BarChart>
        );
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{chart.title}</CardTitle>
          {chart.description && (
            <TooltipProvider>
              <UiTooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground/60"
                    aria-label={t('common.showDescription', 'Show description')}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">{chart.description}</p>
                </TooltipContent>
              </UiTooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ChartSizedContainer height={288}>{(width, height) => renderChart(width, height)}</ChartSizedContainer>
      </CardContent>
    </Card>
  );
}
