/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { useMemo } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

import { Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { HelpTooltip } from '@/components/common/HelpTooltip';
import { ChartTooltipContent, getChartColor } from '@/components/ui/chart';
import type { Chart as ChartSchema, Placement } from '../types/schema';
import type { Metric, Period } from '../types/metrics';
import { bucketTimestamps, bucketValues, getBucketCount, formatTimeTick, formatValue } from '../helpers';
import { ChartSizedContainer } from './ChartSizedContainer';
import { toneClasses } from './tone';
import { cn } from '@/lib/utils';

interface DashboardChartProps {
  chart: ChartSchema & Placement;
  historySamples: Metric[];
  historyWindow: { from: Date; to: Date };
  period: Period;
  className?: string;
}

export function DashboardChart({ chart, historySamples, historyWindow, period, className }: DashboardChartProps) {
  const toneClass = toneClasses(chart.tone);
  const { from, to } = historyWindow;
  const bucketCount = getBucketCount(period);
  const valueFormat = chart.valueFormat ?? 'number';

  const data = useMemo(() => {
    const seriesValues = chart.series.map((series) => bucketValues(series, historySamples, from, to, bucketCount));
    const timestamps = bucketTimestamps(from, to, bucketCount);

    const points = timestamps.map((ts, i) => {
      const point: Record<string, unknown> = {
        time: ts.getTime(),
        timeLabel: formatTimeTick(ts, period),
      };
      chart.series.forEach((series, s) => {
        point[series.label] = seriesValues[s][i];
      });
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
      margin: { top: 6, right: 4, left: 0, bottom: 0 },
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
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 0 }}
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
              fillOpacity={chart.stacked ? 0.35 : 0.14}
              strokeWidth={2}
              activeDot={{ r: 3.5, strokeWidth: 0 }}
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
              radius={chart.stacked ? 0 : [4, 4, 0, 0]}
              maxBarSize={28}
              stackId={chart.stacked ? '1' : undefined}
              isAnimationActive={false}
            />
          );
      }
    });

    const axes = (
      <>
        <CartesianGrid vertical={false} className="stroke-border" />
        <XAxis
          dataKey="timeLabel"
          tick={{ fontSize: 10.5, fill: 'var(--dim)' }}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={16}
        />
        <YAxis
          tickFormatter={tickFormatter}
          tick={{ fontSize: 10.5, fill: 'var(--dim)' }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip
          cursor={chart.kind === 'bar' ? { fill: 'var(--muted)', opacity: 0.6 } : { stroke: 'var(--input)' }}
          content={({ active, payload, label }) => (
            <ChartTooltipContent
              active={active}
              payload={payload}
              label={label as string}
              formatter={tooltipFormatter}
            />
          )}
        />
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
    <Card
      role="figure"
      aria-label={chart.title}
      className={cn('flex flex-col gap-3 px-5 pb-3.5 pt-[18px]', toneClass.surface, className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="section-title truncate">{chart.title}</h2>
          {chart.description && <HelpTooltip content={chart.description} label={chart.title} icon={Info} />}
        </div>
        {chart.series.length > 0 && (
          <ul className={cn('flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px]', toneClass.muted)}>
            {chart.series.map((s, i) => (
              <li key={`${s.label}-${i}`} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: getChartColor(i) }}
                />
                {s.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ChartSizedContainer fill={chart.rows === 2}>{(width, height) => renderChart(width, height)}</ChartSizedContainer>
    </Card>
  );
}
