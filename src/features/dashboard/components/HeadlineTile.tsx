/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Headline, Placement } from '../types/schema';
import type { Metric } from '../types/metrics';
import { headlineRatio } from '../helpers';
import { toneClasses } from './tone';
import { TileHeader } from './TileHeader';

interface HeadlineTileProps {
  headline: Headline & Placement;
  className?: string;
  historySamples: Metric[];
}

export function HeadlineTile({ headline, className, historySamples }: HeadlineTileProps) {
  const { t } = useTranslation();
  const toneClass = toneClasses(headline.tone);
  const ratio = headlineRatio(headline, historySamples);

  return (
    <Card
      role="figure"
      aria-label={headline.title}
      className={cn('flex min-h-[148px] flex-col gap-3 px-5 pb-5 pt-[18px]', toneClass.surface, className)}
    >
      <TileHeader icon={headline.icon} title={headline.title} badgeClass={toneClass.badge} />
      <div
        data-slot="headline-value"
        className="font-display text-[2.75rem] font-[750] leading-none tracking-[-0.035em] tabular-nums"
      >
        {ratio === null ? t('dashboard.noData', 'No data') : formatPercent(ratio * 100)}
      </div>
      {headline.description && (
        <p className={cn('text-[13px] leading-relaxed', toneClass.muted)}>{headline.description}</p>
      )}
    </Card>
  );
}
