/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '@/lib/jmapErrors';
import type { StreamStatus } from '@/services/sse';
import { useDeliveryTrace, type DeliveryRun } from './hooks/useDeliveryTrace';
import { DeliveryTraceForm } from './components/DeliveryTraceForm';
import { DeliveryTraceResult, type DeliveryTracePhase } from './components/DeliveryTraceResult';

type TFn = ReturnType<typeof useTranslation>['t'];

function tracePhase(t: TFn, status: StreamStatus, run: DeliveryRun | null): DeliveryTracePhase | null {
  if (!run) return null;
  if (run.completedAt !== null) return { kind: 'completed' };
  switch (status.kind) {
    case 'open':
      return { kind: 'running' };
    case 'failed':
      switch (status.error.reason) {
        case 'timeout':
          return { kind: 'failed', error: t('deliveryTrace.timedOut', 'Trace timed out after 120 seconds.') };
        case 'token':
          return {
            kind: 'failed',
            error: errorMessage(status.error.cause, t('deliveryTrace.failedToStart', 'Failed to start trace.')),
          };
        case 'rejected':
          return { kind: 'failed', error: t('deliveryTrace.rejected', 'The server refused the trace stream.') };
        default:
          return {
            kind: 'failed',
            error: t('deliveryTrace.connectionLost', 'Connection lost before trace completed.'),
          };
      }
    default:
      return null;
  }
}

export function DeliveryTracePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { status, run, start, reset } = useDeliveryTrace();
  const [target, setTarget] = useState(() => searchParams.get('target') ?? '');
  const phase = tracePhase(t, status, run);

  if (!run || !phase) {
    return (
      <DeliveryTraceForm
        target={target}
        onTargetChange={setTarget}
        starting={status.kind === 'connecting'}
        onStart={start}
      />
    );
  }

  return <DeliveryTraceResult run={run} phase={phase} onCancel={reset} onReset={reset} />;
}
