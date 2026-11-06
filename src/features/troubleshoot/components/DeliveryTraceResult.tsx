/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleCheck, CircleX, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatElapsed } from '@/lib/format';
import { groupByAttempt, pairStages, summarizeDelivery } from '../stages';
import type { DeliveryRun } from '../hooks/useDeliveryTrace';
import { StageRow } from './StageRow';

export type DeliveryTracePhase = { kind: 'running' } | { kind: 'completed' } | { kind: 'failed'; error: string };

interface DeliveryTraceResultProps {
  run: DeliveryRun;
  phase: DeliveryTracePhase;
  onCancel: () => void;
  onReset: () => void;
}

function Banner({ destructive, children }: { destructive?: boolean; children: ReactNode }) {
  return (
    <div
      role={destructive ? 'alert' : 'status'}
      className={cn(destructive ? 'rounded-xl bg-destructive-soft p-4 text-destructive' : 'tile px-5 py-4')}
    >
      {children}
    </div>
  );
}

function useElapsedSeconds(startedAt: number, active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [startedAt, active]);
  return seconds;
}

function StartedAgo({ startedAt }: { startedAt: number }) {
  const { t } = useTranslation();
  const s = useElapsedSeconds(startedAt, true);
  return (
    <p className="text-sm text-muted-foreground">
      {s < 60
        ? t('deliveryTrace.startedAgoSec', 'Started {{s}}s ago', { s })
        : t('deliveryTrace.startedAgoMin', 'Started {{m}}m {{s}}s ago', { m: Math.floor(s / 60), s: s % 60 })}
    </p>
  );
}

function CompletionSummary({ run }: { run: DeliveryRun }) {
  const { t } = useTranslation();
  const { attempts, delivered } = summarizeDelivery(run.stages);
  return (
    <Banner>
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className={cn(
            'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold',
            delivered ? 'bg-success-soft text-success' : 'bg-destructive-soft text-destructive',
          )}
        >
          {delivered ? (
            <CircleCheck aria-hidden="true" className="size-3.5" />
          ) : (
            <CircleX aria-hidden="true" className="size-3.5" />
          )}
          {delivered
            ? t('deliveryTrace.deliverySuccessful', 'Delivery successful')
            : t('deliveryTrace.deliveryFailed', 'Delivery failed')}
        </span>
        <span className="text-sm text-muted-foreground">
          {t('deliveryTrace.attemptCount', '{{count}} attempts', { count: attempts })}
          {run.completedAt !== null &&
            ' ' +
              t('deliveryTrace.inDuration', 'in {{elapsed}}', {
                elapsed: formatElapsed(run.completedAt - run.startedAt),
              })}
        </span>
      </div>
    </Banner>
  );
}

function WaitingIndicator() {
  const { t } = useTranslation();
  return (
    <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
      <div aria-hidden="true" className="flex gap-1">
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
        <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:0.2s]" />
        <span className="size-1.5 animate-pulse rounded-full bg-current [animation-delay:0.4s]" />
      </div>
      {t('deliveryTrace.waiting', 'Waiting for more events')}
    </div>
  );
}

export function DeliveryTraceResult({ run, phase, onCancel, onReset }: DeliveryTraceResultProps) {
  const { t } = useTranslation();
  const groups = groupByAttempt(pairStages(run.stages));
  const target = run.target;

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-end justify-between gap-4 px-1 pb-1 pt-3">
        <div className="min-w-0 space-y-1">
          <h1 className="page-title break-words">
            {phase.kind === 'running'
              ? t('deliveryTrace.tracingDelivery', 'Tracing delivery to {{target}}', { target })
              : phase.kind === 'completed'
                ? t('deliveryTrace.traceCompletedFor', 'Trace completed for {{target}}', { target })
                : t('deliveryTrace.traceFailedFor', 'Trace failed for {{target}}', { target })}
          </h1>
          {phase.kind === 'running' && <StartedAgo startedAt={run.startedAt} />}
        </div>
        {phase.kind === 'running' ? (
          <Button variant="outline" onClick={onCancel}>
            <StopCircle aria-hidden="true" />
            {t('deliveryTrace.cancelTrace', 'Cancel trace')}
          </Button>
        ) : (
          <Button variant="outline" onClick={onReset}>
            {t('deliveryTrace.runAnother', 'Run another trace')}
          </Button>
        )}
      </div>

      {phase.kind === 'completed' && <CompletionSummary run={run} />}
      {phase.kind === 'failed' && (
        <Banner destructive>
          <p className="text-sm">{phase.error}</p>
        </Banner>
      )}

      <Card>
        <CardContent className="p-5">
          <div aria-live="polite">
            {groups.map((group) => (
              <div key={group.key}>
                {group.attempt && (
                  <div className="mb-1 mt-3 first:mt-0">
                    <StageRow stage={group.attempt.stage} />
                  </div>
                )}
                <div className={group.attempt ? 'ml-3 border-l-2 border-input pl-5' : undefined}>
                  {group.stages.map((item) => (
                    <StageRow key={item.key} stage={item.stage} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {phase.kind === 'running' && <WaitingIndicator />}
        </CardContent>
      </Card>
    </div>
  );
}
