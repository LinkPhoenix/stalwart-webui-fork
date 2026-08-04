/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, FileText, Clock, Timer, Activity, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSchemaStore } from '@/stores/schemaStore';
import { jmapGet, getAccountId } from '@/services/jmap/client';
import { resolveObject } from '@/lib/schemaResolver';
import type { TraceEvent, TraceKeyValue, TraceValue } from '../types';
import { TraceTimeline } from './TraceTimeline';

import { jmapMapToArray } from '@/lib/jmapUtils';

function normalizeTraceEvents(raw: unknown): TraceEvent[] {
  const events = jmapMapToArray<Record<string, unknown>>(raw);
  return events.map((evt) => ({
    event: String(evt.event ?? ''),
    timestamp: String(evt.timestamp ?? ''),
    keyValues: normalizeKeyValues(evt.keyValues),
  }));
}

function normalizeKeyValues(raw: unknown): TraceKeyValue[] {
  const kvs = jmapMapToArray<Record<string, unknown>>(raw);
  return kvs.map((kv) => ({
    key: String(kv.key ?? ''),
    value: normalizeTraceValue(kv.value),
  }));
}

function normalizeTraceValue(raw: unknown): TraceValue {
  if (!raw || typeof raw !== 'object') return { '@type': 'Null' };
  const obj = raw as Record<string, unknown>;
  const type = obj['@type'] as string;

  if (type === 'List') {
    return { '@type': 'List', value: jmapMapToArray<unknown>(obj.value).map(normalizeTraceValue) };
  }
  if (type === 'Event') {
    return { '@type': 'Event', event: String(obj.event ?? ''), value: normalizeKeyValues(obj.value) };
  }
  return raw as TraceValue;
}

interface TraceDetailViewProps {
  viewName: string;
  objectId: string;
}

export function TraceDetailView({ viewName, objectId }: TraceDetailViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const schema = useSchemaStore((s) => s.schema);
  const viewToSection = useSchemaStore((s) => s.viewToSection);
  const listPath = viewToSection[viewName] ? `/${viewToSection[viewName]}/${viewName}` : null;
  const [events, setEvents] = useState<TraceEvent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backButton = (size: 'default' | 'sm' = 'default') =>
    listPath ? (
      <Button variant="outline" size={size} asChild>
        <Link to={listPath}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('common.back', 'Back')}
        </Link>
      </Button>
    ) : (
      <Button variant="outline" size={size} onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t('common.back', 'Back')}
      </Button>
    );

  useEffect(() => {
    if (!schema) return;
    let cancelled = false;

    async function load() {
      try {
        const resolved = resolveObject(schema!, viewName);
        if (!resolved) throw new Error(t('view.couldNotResolve', 'Could not resolve object'));

        const accountId = getAccountId(resolved.objectName);
        const responses = await jmapGet(resolved.objectName, accountId, [objectId]);

        if (cancelled) return;

        const getResult = responses.find(([name]) => name.endsWith('/get'));
        if (!getResult) throw new Error(t('view.noGetResponse', 'No get response'));

        const data = getResult[1] as { list?: Array<{ id: string; events?: unknown }> };
        const trace = data.list?.[0];
        if (!trace) throw new Error(t('tracing.traceNotFound', 'Trace not found'));

        setEvents(normalizeTraceEvents(trace.events));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('tracing.failedToLoadTrace', 'Failed to load trace'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [schema, viewName, objectId, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        {backButton()}
        <div className="text-destructive p-4">{error}</div>
      </div>
    );
  }

  if (!events) return null;

  const eventTypeEnum = schema?.enums?.['EventType'] ?? [];
  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];

  const spanLabel = firstEvent
    ? (eventTypeEnum.find((e) => e.name === firstEvent.event)?.label ?? firstEvent.event)
    : '-';

  const dateStr = firstEvent
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
      }).format(new Date(firstEvent.timestamp))
    : '-';

  const durationMs =
    firstEvent && lastEvent && events.length >= 2
      ? new Date(lastEvent.timestamp).getTime() - new Date(firstEvent.timestamp).getTime()
      : null;

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)} ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
    const m = Math.floor(ms / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    return `${m}m ${s}s`;
  }

  return (
    <div className="space-y-6">
      {backButton('sm')}

      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              {t('tracing.spanType', 'Span Type')}
            </div>
            <p className="mt-1 text-lg font-semibold truncate">{spanLabel}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {t('tracing.date', 'Date')}
            </div>
            <p className="mt-1 text-lg font-semibold">{dateStr}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Timer className="h-4 w-4" />
              {t('tracing.duration', 'Duration')}
            </div>
            <p className="mt-1 text-lg font-semibold">{durationMs !== null ? formatDuration(durationMs) : '-'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              {t('tracing.events', 'Events')}
            </div>
            <p className="mt-1 text-lg font-semibold">{events.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <TraceTimeline events={events} anchorTimestamp={firstEvent?.timestamp} />
        </CardContent>
      </Card>
    </div>
  );
}
