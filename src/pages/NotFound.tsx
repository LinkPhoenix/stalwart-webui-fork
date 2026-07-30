/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function NotFound() {
  const { t } = useTranslation();

  useDocumentTitle(t('errors.notFound'));

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">{t('errors.notFound')}</p>
        <Link to="/" className="mt-4 inline-block text-primary underline hover:no-underline">
          {t('common.back')}
        </Link>
      </div>
    </div>
  );
}
