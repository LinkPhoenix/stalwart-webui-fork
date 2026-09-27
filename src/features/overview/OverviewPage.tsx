/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Loader2, PanelsTopLeft, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { SchemaIcon } from '@/components/common/SchemaIcon';
import { useAccountStore } from '@/stores/accountStore';
import { useSchemaStore } from '@/stores/schemaStore';
import { OVERVIEW_CARDS, OVERVIEW_SECTIONS } from '@/features/overview/cards';
import {
  deriveAttention,
  fetchCardTotals,
  resolveQueryableCards,
  type CardTotal,
  type ResolvedOverviewCard,
} from '@/features/overview/fetchTotals';

/** Manual refresh is rate-limited so the overview can't hammer JMAP. */
const REFRESH_COOLDOWN_MS = 10_000;

function LucideIcon({ name, className }: { name: string; className?: string }) {
  return <SchemaIcon name={name} className={className} fallback={HelpCircle} warnUnknown />;
}

function OverviewStatCard({
  card,
  total,
  loading,
}: {
  card: ResolvedOverviewCard;
  total: CardTotal | undefined;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const attention = deriveAttention(card, total);

  let value: string;
  let subtitle: string | null = null;
  if (loading && !total) {
    value = '…';
  } else if (!total || total.status === 'unavailable' || typeof total.total !== 'number') {
    value = t('overview.unavailable', '—');
    if (total?.unavailableReason === 'requestFailed') {
      subtitle = t('overview.countRequestFailed', 'Could not reach the server. Try refreshing the overview.');
    } else if (total?.unavailableReason === 'queryRejected') {
      subtitle = t('overview.countQueryRejected', 'The server could not complete this count query.');
    } else if (total?.unavailableReason === 'missingTotal') {
      subtitle = t('overview.countMissingTotal', 'The server response did not include a count.');
    }
  } else {
    value = total.total.toLocaleString();
  }

  if (card.enrich === 'certificateValidity' && total?.status === 'ok' && typeof total.valid === 'number') {
    const parts = [
      t('overview.certificatesValid', '{{count}} valid', { count: total.valid }),
      t('overview.certificatesExpired', '{{count}} expired', { count: total.expired ?? 0 }),
    ];
    if ((total.expiringSoon ?? 0) > 0) {
      parts.push(t('overview.certificatesExpiring', '{{count}} expiring soon', { count: total.expiringSoon }));
    }
    subtitle = parts.join(' · ');
  } else if (
    card.enrich === 'reportProblems' &&
    total?.status === 'ok' &&
    typeof total.problemCount === 'number' &&
    total.problemCount > 0
  ) {
    subtitle = t('overview.reportProblemsDetail', '{{count}} with issues in latest {{sample}}', {
      count: total.problemCount,
      sample: total.sampleSize ?? total.problemCount,
    });
  } else if (card.enrich === 'queueAttention' && total?.status === 'ok' && (total.total ?? 0) > 0) {
    subtitle = t('overview.queueBacklog', 'Messages waiting in the queue');
  }

  return (
    <Link to={card.href} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card
        className={cn(
          'h-full transition-colors hover:bg-muted/40',
          attention === 'warn' && 'border-amber-500/60',
          attention === 'danger' && 'border-destructive/70',
        )}
      >
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <LucideIcon name={card.icon} className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 text-sm font-medium">{t(...card.labelKey)}</span>
            {attention === 'warn' && (
              <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
                {t('overview.attentionWarn', 'Attention')}
              </Badge>
            )}
            {attention === 'danger' && (
              <Badge variant="destructive">{t('overview.attentionDanger', 'Needs attention')}</Badge>
            )}
          </div>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

// SCHEMA-DEVIATION: community-overview-nav-entry (see SCHEMA_DEVIATIONS.md)
export function OverviewPage() {
  const { t } = useTranslation();
  const schema = useSchemaStore((s) => s.schema);
  const viewToSection = useSchemaStore((s) => s.viewToSection);
  const hasObjectPermission = useAccountStore((s) => s.hasObjectPermission);

  const cards = useMemo(() => {
    if (!schema) return [];
    return resolveQueryableCards(schema, OVERVIEW_CARDS, viewToSection, (prefix) =>
      hasObjectPermission(prefix, 'Query'),
    );
  }, [schema, viewToSection, hasObjectPermission]);

  const cardsKey = cards.map((c) => c.id).join(',');
  const [totals, setTotals] = useState<Record<string, CardTotal>>({});
  const [loadedFor, setLoadedFor] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshOnCooldown, setRefreshOnCooldown] = useState(false);
  const refreshCooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loading = cards.length > 0 && loadedFor !== cardsKey;

  useEffect(() => {
    return () => {
      if (refreshCooldownTimer.current) clearTimeout(refreshCooldownTimer.current);
    };
  }, []);

  useEffect(() => {
    if (cards.length === 0) return;

    const controller = new AbortController();
    let cancelled = false;

    void fetchCardTotals(cards, controller.signal)
      .then((next) => {
        if (cancelled) return;
        setTotals(next);
        setLoadedFor(cardsKey);
      })
      .catch(() => {
        if (cancelled) return;
        setTotals({});
        setLoadedFor(cardsKey);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [cards, cardsKey]);

  async function handleRefresh() {
    if (cards.length === 0 || loading || refreshing || refreshOnCooldown) return;
    setRefreshOnCooldown(true);
    if (refreshCooldownTimer.current) clearTimeout(refreshCooldownTimer.current);
    refreshCooldownTimer.current = setTimeout(() => setRefreshOnCooldown(false), REFRESH_COOLDOWN_MS);

    setRefreshing(true);
    try {
      const next = await fetchCardTotals(cards);
      setTotals(next);
      setLoadedFor(cardsKey);
    } catch {
      setTotals({});
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <PanelsTopLeft className="h-7 w-7 shrink-0 text-primary" aria-hidden />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{t('overview.title', 'Overview')}</h1>
            <p className="text-sm text-muted-foreground">
              {t(
                'overview.subtitle',
                'Inventory of directory objects, mail readiness, and reports. Live telemetry stays on the Enterprise Dashboard.',
              )}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleRefresh()}
          disabled={loading || refreshing || refreshOnCooldown || cards.length === 0}
          title={
            refreshOnCooldown
              ? t('overview.refreshCooldown', 'Please wait a few seconds before refreshing again')
              : undefined
          }
        >
          {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {t('overview.refresh', 'Refresh')}
        </Button>
      </div>

      {cards.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t('overview.noPermission', 'No inventory objects are available with your current permissions.')}
          </CardContent>
        </Card>
      ) : (
        OVERVIEW_SECTIONS.map((section) => {
          const sectionCards = cards.filter((c) => c.section === section.id);
          if (sectionCards.length === 0) return null;
          return (
            <section key={section.id} className="space-y-3">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {t(...section.titleKey)}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sectionCards.map((card) => (
                  <OverviewStatCard key={card.id} card={card} total={totals[card.id]} loading={loading} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
