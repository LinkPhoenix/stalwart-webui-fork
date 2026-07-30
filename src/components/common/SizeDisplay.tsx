/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

import { formatSize } from '@/lib/durationFormat';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SizeDisplayProps {
  bytes: number;
  className?: string;
}

/**
 * Formats a byte size. Negative values (stale Stalwart quota counters) are
 * shown in red with an info tooltip pointing admins at recalculateQuota.
 */
export function SizeDisplay({ bytes, className }: SizeDisplayProps): ReactNode {
  const { t } = useTranslation();
  const label = Number.isFinite(bytes) ? formatSize(bytes) : formatSize(0);

  if (!Number.isFinite(bytes) || bytes >= 0) {
    return <span className={className}>{label}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`.trim()}>
      <span className="font-medium text-destructive">{label}</span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex shrink-0 text-destructive hover:text-destructive/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label={t('list.negativeQuotaInfoAria', 'Why is disk usage negative?')}
              onClick={(e) => e.stopPropagation()}
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-left">
            {t(
              'list.negativeQuotaTooltip',
              'This disk-usage counter is out of sync (often after a migration or reset). Schedule a task: Perform account maintenance operations → Recalculate storage quota usage for the account. Or for all accounts: Perform store maintenance operations → Reset all user quotas.',
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}
