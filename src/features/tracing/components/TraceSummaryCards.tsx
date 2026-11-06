/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, Clock, FileText, Timer, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { formatDateTime, formatElapsed, formatNumber } from '@/lib/format';
import { traceDurationMs } from '../format';
import { useTraceLabels } from '../hooks/useTraceLabels';
import type { TraceEvent } from '../types';

function SummaryCard({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <Card className="flex min-w-0 items-center gap-3 px-5 py-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-highlight text-highlight-foreground">
        <Icon aria-hidden="true" className="size-[17px]" />
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-muted-foreground">{label}</div>
        <p className="truncate font-display text-lg font-bold tracking-[-0.012em]">{children}</p>
      </div>
    </Card>
  );
}

export function TraceSummaryCards({ events }: { events: TraceEvent[] }) {
  const { t } = useTranslation();
  const labels = useTraceLabels();
  const first = events.at(0);
  const last = events.at(-1);
  const durationMs = first && last && events.length >= 2 ? traceDurationMs(first.timestamp, last.timestamp) : null;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
      <SummaryCard icon={FileText} label={t('tracing.spanType', 'Span Type')}>
        {first ? labels.event(first.event).label : '-'}
      </SummaryCard>
      <SummaryCard icon={Clock} label={t('tracing.date', 'Date')}>
        {first ? formatDateTime(first.timestamp, 'medium') : '-'}
      </SummaryCard>
      <SummaryCard icon={Timer} label={t('tracing.duration', 'Duration')}>
        {durationMs !== null ? formatElapsed(durationMs) : '-'}
      </SummaryCard>
      <SummaryCard icon={Activity} label={t('tracing.events', 'Events')}>
        {formatNumber(events.length)}
      </SummaryCard>
    </div>
  );
}
