/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { ChevronRight, CircleCheck, CircleX, Globe, Loader2, Mail, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { formatElapsed } from '@/lib/format';
import { phaseLabel, stageBody } from '../stageText';
import { stageSeverity, type DeliveryStage, type MX, type ReportUri, type StageSeverity } from '../types';

const SEVERITY_BADGE: Record<StageSeverity, string> = {
  pending: 'bg-info-soft text-info',
  ok: 'bg-success-soft text-success',
  warn: 'bg-warning-soft text-warning',
  error: 'bg-destructive-soft text-destructive',
};

function SeverityIcon({ severity }: { severity: StageSeverity }) {
  const { t } = useTranslation();
  const badge = cn('grid size-6 place-items-center rounded-full', SEVERITY_BADGE[severity]);
  switch (severity) {
    case 'pending':
      return (
        <span className={badge}>
          <Loader2
            role="img"
            aria-label={t('deliveryTrace.severity.pending', 'In progress')}
            className="size-3.5 animate-spin"
          />
        </span>
      );
    case 'ok':
      return (
        <span className={badge}>
          <CircleCheck role="img" aria-label={t('deliveryTrace.severity.ok', 'Succeeded')} className="size-3.5" />
        </span>
      );
    case 'warn':
      return (
        <span className={badge}>
          <TriangleAlert role="img" aria-label={t('deliveryTrace.severity.warn', 'Warning')} className="size-3.5" />
        </span>
      );
    case 'error':
      return (
        <span className={badge}>
          <CircleX role="img" aria-label={t('deliveryTrace.severity.error', 'Failed')} className="size-3.5" />
        </span>
      );
  }
}

function MxTable({ mxs }: { mxs: MX[] }) {
  const rows = [...mxs]
    .sort((a, b) => a.preference - b.preference)
    .flatMap((mx) => mx.exchanges.map((exchange) => ({ preference: mx.preference, exchange })));
  return (
    <div className="mt-1.5 divide-y divide-border rounded-xl bg-muted px-1 py-0.5 text-xs">
      {rows.map(({ preference, exchange }) => (
        <div key={`${preference}-${exchange}`} className="flex gap-3 px-3 py-1.5">
          <span className="w-8 text-right tabular-nums text-muted-foreground">{preference}</span>
          <span className="font-mono">{exchange}</span>
        </div>
      ))}
    </div>
  );
}

function ReportUris({ rua }: { rua: ReportUri[] }) {
  return (
    <ul className="mt-1.5 space-y-1 rounded-xl bg-muted p-3">
      {rua.map((uri) => {
        const value = uri.type === 'mail' ? uri.email : uri.url;
        const Icon = uri.type === 'mail' ? Mail : Globe;
        return (
          <li key={`${uri.type}:${value}`} className="flex items-center gap-2 text-xs">
            <Icon aria-hidden="true" className="size-3 text-muted-foreground" />
            <span className="break-all font-mono">{value}</span>
          </li>
        );
      })}
    </ul>
  );
}

function OpaqueObject({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="mt-1.5 rounded-xl bg-muted p-3">
      <dl className="space-y-1 text-xs">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="min-w-24 font-medium text-muted-foreground">{k}</dt>
            <dd className="break-all">
              {typeof v === 'object' && v !== null ? (
                <pre className="whitespace-pre-wrap font-mono text-xs">{JSON.stringify(v, null, 2)}</pre>
              ) : (
                String(v)
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function StageDetails({ stage }: { stage: DeliveryStage }) {
  switch (stage.type) {
    case 'mxLookupSuccess':
      return <MxTable mxs={stage.mxs} />;
    case 'mtaStsFetchSuccess':
      return <OpaqueObject data={stage.policy} />;
    case 'tlsRptLookupSuccess':
      return <ReportUris rua={stage.rua} />;
    case 'tlsaLookupSuccess':
      return <OpaqueObject data={stage.record} />;
    default:
      return null;
  }
}

function hasDetails(stage: DeliveryStage): boolean {
  return (
    stage.type === 'mxLookupSuccess' ||
    stage.type === 'mtaStsFetchSuccess' ||
    stage.type === 'tlsRptLookupSuccess' ||
    stage.type === 'tlsaLookupSuccess'
  );
}

export function StageRow({ stage }: { stage: DeliveryStage }) {
  const { t } = useTranslation();
  const severity = stageSeverity(stage);
  const body = stageBody(t, stage);
  const elapsed = 'elapsed' in stage ? stage.elapsed : null;

  const content = (
    <div className="flex items-start gap-3 py-2">
      <div className="shrink-0">
        <SeverityIcon severity={severity} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-h-6 flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{phaseLabel(t, stage)}</span>
          {elapsed !== null && (
            <Badge variant="secondary" className="text-xs tabular-nums">
              {formatElapsed(elapsed)}
            </Badge>
          )}
        </div>
        {body && (
          <p className={cn('mt-0.5 text-xs', severity === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
            {body}
          </p>
        )}
      </div>
    </div>
  );

  if (!hasDetails(stage)) return content;

  return (
    <Collapsible>
      {content}
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group ml-9 flex items-center gap-1 rounded-full text-xs font-medium text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight aria-hidden="true" className="size-3 transition-transform group-data-[state=open]:rotate-90" />
          {t('deliveryTrace.viewDetails', 'View details')}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-9">
        <StageDetails stage={stage} />
      </CollapsibleContent>
    </Collapsible>
  );
}
