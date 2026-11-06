/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function ListSpinner({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <div role="status" className={className ?? 'flex items-center justify-center p-8'}>
      <Loader2 className="h-6 w-6 animate-spin text-brand-text" aria-hidden />
      <span className="sr-only">{t('common.loading', 'Loading...')}</span>
    </div>
  );
}

export function ListMessage({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-muted p-10 text-center text-muted-foreground">{children}</div>;
}

export function ListTableMessage({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="border-t border-border px-3 py-12 text-center text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}

export function ListError({
  message,
  onRetry,
  onDismiss,
}: {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-xl bg-destructive-soft p-4 text-sm text-destructive"
    >
      <span className="whitespace-pre-line">{message}</span>
      <div className="flex shrink-0 items-center gap-1">
        {onRetry && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onRetry}
          >
            {t('common.retry', 'Retry')}
          </Button>
        )}
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDismiss}
            aria-label={t('common.close', 'Close')}
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
