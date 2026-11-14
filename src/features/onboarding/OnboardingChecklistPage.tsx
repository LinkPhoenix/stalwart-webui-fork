/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleCheck, CircleAlert, ExternalLink, HelpCircle, Loader2, Rocket } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAccountStore } from '@/stores/accountStore';
import { useSchemaStore } from '@/stores/schemaStore';
import { resolveObject } from '@/lib/schemaResolver';
import {
  ONBOARDING_DOC_LINKS,
  ONBOARDING_ITEMS,
  type CheckStatus,
  type OnboardingFurtherLink,
} from '@/features/onboarding/checklist';

function StatusIcon({ status }: { status: CheckStatus }) {
  switch (status) {
    case 'loading':
      return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />;
    case 'done':
      return <CircleCheck className="h-5 w-5 shrink-0 text-green-600" />;
    case 'pending':
      return <CircleAlert className="h-5 w-5 shrink-0 text-amber-500" />;
    case 'unknown':
      return <HelpCircle className="h-5 w-5 shrink-0 text-muted-foreground" />;
  }
}

function findSchemaFurtherLinks(
  schema: NonNullable<ReturnType<typeof useSchemaStore.getState>['schema']>,
  viewToSection: Record<string, string>,
  canQuery: (prefix: string) => boolean,
): OnboardingFurtherLink[] {
  const links: OnboardingFurtherLink[] = [];

  const spamView = Object.keys(schema.objects).find(
    (name) => /^x:Spam/i.test(name) && !name.includes('/') && resolveObject(schema, name),
  );
  if (spamView) {
    const resolved = resolveObject(schema, spamView);
    if (resolved && canQuery(resolved.permissionPrefix)) {
      const section = viewToSection[spamView] ?? 'Settings';
      links.push({
        id: 'spam-settings',
        titleKey: ['onboarding.further.spamTitle', 'Review spam settings'],
        descriptionKey: ['onboarding.further.spamDescription', 'Tune classification and lists once mail is flowing.'],
        href: `/${section}/${spamView}`,
      });
    }
  }

  const listenerView = Object.keys(schema.objects).find(
    (name) => /Listener/i.test(name) && !name.includes('/') && resolveObject(schema, name),
  );
  if (listenerView) {
    const resolved = resolveObject(schema, listenerView);
    if (resolved && canQuery(resolved.permissionPrefix)) {
      const section = viewToSection[listenerView] ?? 'Settings';
      links.push({
        id: 'listeners',
        titleKey: ['onboarding.further.listenersTitle', 'Check network listeners'],
        descriptionKey: [
          'onboarding.further.listenersDescription',
          'Confirm SMTP/IMAP/HTTPS listeners match how you expose the server.',
        ],
        href: `/${section}/${listenerView}`,
      });
    }
  }

  return links;
}

export function OnboardingChecklistPage() {
  const { t } = useTranslation();
  const hasObjectPermission = useAccountStore((s) => s.hasObjectPermission);
  const schema = useSchemaStore((s) => s.schema);
  const viewToSection = useSchemaStore((s) => s.viewToSection);

  // Items without permission start (and stay) 'unknown' — computed here rather
  // than in the effect below so that branch never calls setState synchronously
  // from within the effect body.
  const [statuses, setStatuses] = useState<Record<string, CheckStatus>>(() =>
    Object.fromEntries(
      ONBOARDING_ITEMS.map((item) => [
        item.id,
        hasObjectPermission(item.permissionPrefix, 'Query') ? 'loading' : 'unknown',
      ]),
    ),
  );

  useEffect(() => {
    let cancelled = false;

    for (const item of ONBOARDING_ITEMS) {
      if (!hasObjectPermission(item.permissionPrefix, 'Query')) continue;
      item
        .check()
        .then((done) => {
          if (!cancelled) setStatuses((prev) => ({ ...prev, [item.id]: done ? 'done' : 'pending' }));
        })
        .catch(() => {
          if (!cancelled) setStatuses((prev) => ({ ...prev, [item.id]: 'unknown' }));
        });
    }

    return () => {
      cancelled = true;
    };
  }, [hasObjectPermission]);

  const requiredItems = ONBOARDING_ITEMS.filter((item) => item.requiredForCompletion !== false);
  const doneCount = requiredItems.filter((item) => statuses[item.id] === 'done').length;

  const furtherLinks = useMemo(() => {
    const schemaLinks =
      schema != null
        ? findSchemaFurtherLinks(schema, viewToSection, (prefix) => hasObjectPermission(prefix, 'Query'))
        : [];
    return [...ONBOARDING_DOC_LINKS, ...schemaLinks];
  }, [schema, viewToSection, hasObjectPermission]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pt-8">
      <div className="flex items-center gap-3">
        <Rocket className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('onboarding.title', 'Getting Started')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('onboarding.subtitle', 'A quick checklist for a new Stalwart install. {{done}} of {{total}} done.', {
              done: doneCount,
              total: requiredItems.length,
            })}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {ONBOARDING_ITEMS.map((item) => {
          const status = statuses[item.id] ?? 'loading';
          const optional = item.requiredForCompletion === false;
          return (
            <Card key={item.id}>
              <CardContent className="flex items-start gap-3 pt-6">
                <StatusIcon status={status} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium leading-none">{t(...item.titleKey)}</p>
                    {optional && <Badge variant="secondary">{t('onboarding.optional', 'Optional')}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{t(...item.descriptionKey)}</p>
                  {status === 'unknown' && (
                    <p className="text-xs text-muted-foreground italic">
                      {t('onboarding.unknown', "Couldn't be checked — you may not have permission to view this.")}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" asChild className="shrink-0">
                  <Link to={item.actionHref}>{t(...item.actionLabelKey)}</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('onboarding.moreTitle', 'Want to go further?')}</CardTitle>
          <CardDescription>
            {t(
              'onboarding.moreDescription',
              'DNS authentication docs and related settings. The Enterprise Dashboard and Delivery tests cover live metrics and outbound diagnostics.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {furtherLinks.map((link) => (
            <div key={link.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium">{t(...link.titleKey)}</p>
                <p className="text-xs text-muted-foreground">{t(...link.descriptionKey)}</p>
              </div>
              <Button variant="outline" size="sm" asChild className="shrink-0">
                {link.external ? (
                  <a href={link.href} target="_blank" rel="noreferrer">
                    {t('onboarding.further.openDocs', 'Docs')}
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                ) : (
                  <Link to={link.href}>{t('onboarding.further.open', 'Open')}</Link>
                )}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
