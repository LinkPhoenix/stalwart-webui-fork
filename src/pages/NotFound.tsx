/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function NotFound() {
  const { t } = useTranslation();

  useDocumentTitle(t('errors.notFound', 'The requested resource was not found.'));

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="tile w-full max-w-sm px-8 py-10 text-center">
        <span className="eyebrow mx-auto">404</span>
        <h1 className="page-title mt-4">{t('errors.notFound')}</h1>
        <Button asChild className="mt-6">
          <Link to="/">
            <ArrowLeft aria-hidden="true" />
            {t('common.back')}
          </Link>
        </Button>
      </div>
    </div>
  );
}
