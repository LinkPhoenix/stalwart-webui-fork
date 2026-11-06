/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export function LoadingFallback({ fullScreen = false }: { fullScreen?: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3',
        fullScreen ? 'min-h-screen bg-background' : 'p-8',
      )}
    >
      <Loader2 className="h-7 w-7 animate-spin text-brand-text" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
    </div>
  );
}
