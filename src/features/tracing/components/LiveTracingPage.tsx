/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '@/lib/jmapErrors';
import type { StreamStatus } from '@/services/sse';
import type { KeyValueFilter } from '../liveTracing';
import { useLiveTracing } from '../hooks/useLiveTracing';
import { LiveTracingForm } from './LiveTracingForm';
import { LiveTracingSession } from './LiveTracingSession';

type TFn = ReturnType<typeof useTranslation>['t'];

function streamErrorMessage(t: TFn, status: StreamStatus): string | null {
  if (status.kind !== 'failed') return null;
  if (status.error.reason === 'token') {
    return errorMessage(status.error.cause, t('tracing.liveFailedStart', 'Failed to start live tracing.'));
  }
  if (status.error.reason === 'rejected') {
    return t('tracing.liveRejected', 'The server refused the live tracing stream.');
  }
  return t('tracing.liveDisconnected', 'Live tracing stream disconnected after multiple retries.');
}

export function LiveTracingPage() {
  const { t } = useTranslation();
  const { status, buffer, start, stop, reset } = useLiveTracing();
  const [keywords, setKeywords] = useState('');
  const [filters, setFilters] = useState<KeyValueFilter[]>([]);

  const starting = status.kind === 'connecting' && status.attempt === 0;
  if (status.kind === 'idle' || starting) {
    return (
      <LiveTracingForm
        keywords={keywords}
        onKeywordsChange={setKeywords}
        filters={filters}
        onFiltersChange={setFilters}
        starting={starting}
        onStart={() => start(keywords, filters)}
      />
    );
  }

  return (
    <LiveTracingSession
      status={status}
      buffer={buffer}
      error={streamErrorMessage(t, status)}
      onStop={stop}
      onRestart={reset}
    />
  );
}
