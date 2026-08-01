/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

import { Card, CardContent } from '@/components/ui/card';
import changelogSource from '../../../CHANGELOG.md?raw';

// Renders this fork's actual CHANGELOG.md — the single source of truth for
// release notes, kept up to date after every release — instead of a
// separately maintained copy that could drift from it.
const components: Components = {
  h1: () => null,
  h2: ({ children }) => (
    <h2 className="mt-10 border-b pb-2 text-lg font-semibold tracking-tight first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</h3>
  ),
  p: ({ children }) => <p className="text-sm text-muted-foreground">{children}</p>,
  ul: ({ children }) => <ul className="mt-1 list-disc space-y-1.5 pl-5 text-sm">{children}</ul>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline underline-offset-2 hover:no-underline"
    >
      {children}
    </a>
  ),
  code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>,
};

export function ChangelogPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Card>
        <CardContent className="flex items-start gap-3 p-4 sm:p-6">
          <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p className="text-sm leading-relaxed">
            {t(
              'changelog.officialNotice',
              'The official WebUI is maintained by the Stalwart team and is available at',
            )}{' '}
            <a
              href="https://github.com/stalwartlabs/webui"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline underline-offset-2 hover:no-underline"
            >
              https://github.com/stalwartlabs/webui
            </a>
            .
          </p>
        </CardContent>
      </Card>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('changelog.label', 'Changelog')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('changelog.description', "What's new in this fork, release by release.")}
        </p>
      </div>

      <ReactMarkdown components={components}>{changelogSource}</ReactMarkdown>
    </div>
  );
}
