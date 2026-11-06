/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { RotateCcw, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { isStreamActive, type StreamStatus } from '@/services/sse';
import { MAX_LIVE_EVENTS, type TraceBuffer } from '../liveTracing';
import { TraceTimeline } from './TraceTimeline';

interface LiveTracingSessionProps {
  status: StreamStatus;
  buffer: TraceBuffer;
  error: string | null;
  onStop: () => void;
  onRestart: () => void;
}

function StreamIndicator({ status }: { status: StreamStatus }) {
  const { t } = useTranslation();
  if (status.kind === 'open') {
    return (
      <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-success-soft px-2.5 text-xs font-semibold text-success">
        <span aria-hidden="true" className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
        {t('tracing.streamingEvents', 'Streaming events...')}
      </span>
    );
  }
  if (status.kind === 'reconnecting' || status.kind === 'connecting') {
    return (
      <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-warning-soft px-2.5 text-xs font-semibold text-warning">
        <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-current" />
        {t('tracing.reconnecting', 'Reconnecting...')}
      </span>
    );
  }
  if (status.kind === 'closed') {
    return (
      <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs font-semibold text-muted-foreground">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
        {t('tracing.stopped', 'Stopped')}
      </span>
    );
  }
  return null;
}

export function LiveTracingSession({ status, buffer, error, onStop, onRestart }: LiveTracingSessionProps) {
  const { t } = useTranslation();
  const active = isStreamActive(status);
  const count = buffer.events.length;

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-end justify-between gap-4 px-1 pb-1 pt-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="page-title">{t('tracing.liveTitle', 'Live Tracing')}</h1>
          <div role="status">
            <StreamIndicator status={status} />
          </div>
        </div>
        {active ? (
          <Button variant="outline" onClick={onStop}>
            <Square aria-hidden="true" />
            {t('tracing.stopTracing', 'Stop tracing')}
          </Button>
        ) : (
          <Button variant="outline" onClick={onRestart}>
            <RotateCcw aria-hidden="true" />
            {t('tracing.restart', 'Restart')}
          </Button>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-destructive-soft p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-5">
          <TraceTimeline
            events={buffer.events}
            anchorTimestamp={buffer.anchorTimestamp ?? undefined}
            keyOffset={buffer.dropped}
          />
        </CardContent>
      </Card>

      <p className="text-center text-xs text-dim">
        {t('tracing.eventCount', '{{count}} events', { count })}
        {count >= MAX_LIVE_EVENTS && ' ' + t('tracing.bufferFull', '(buffer full)')}
      </p>
    </div>
  );
}
