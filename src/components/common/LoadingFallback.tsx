/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface LoadingFallbackProps {
  fullScreen?: boolean;
}

export function LoadingFallback({ fullScreen }: LoadingFallbackProps) {
  const { t } = useTranslation();
  return (
    <div className={`flex items-center justify-center ${fullScreen ? 'min-h-screen' : 'p-8'}`}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    </div>
  );
}
