/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiBaseUrl } from '@/services/api';

export function DefaultLogo() {
  const { t } = useTranslation();
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="95 84 500 90"
      aria-label={t('logo.stalwartAlt', 'Stalwart Logo')}
      className="h-7 w-auto max-w-[320px]"
    >
      <path
        className="fill-current"
        d="M227.8 143.6c.3 4.2 2.1 7.6 5.1 10.1 3.1 2.5 7.1 3.8 12.1 3.8 4.3 0 7.9-.9 10.5-2.8 2.7-1.9 4-4.5 4-7.8 0-2.4-.7-4.3-2.2-5.7-1.5-1.4-3.4-2.5-6-3.2-2.5-.7-6-1.5-10.6-2.3-4.6-.8-8.6-1.9-11.9-3.2-3.3-1.3-6-3.3-8.1-6.1-2.1-2.7-3.1-6.3-3.1-10.7 0-4.1 1.1-7.7 3.2-10.9s5.1-5.7 9-7.4c3.8-1.8 8.2-2.6 13.2-2.6 5.1 0 9.6 1 13.7 2.9 4 1.9 7.2 4.5 9.5 7.8s3.6 7.1 3.8 11.4h-11.5c-.4-3.7-2-6.6-4.8-8.9-2.8-2.2-6.3-3.4-10.6-3.4-4.1 0-7.5.9-9.9 2.7-2.5 1.8-3.7 4.3-3.7 7.6 0 2.3.7 4.1 2.2 5.5 1.5 1.4 3.4 2.4 5.9 3.1 2.4.7 5.9 1.4 10.5 2.2 4.6.8 8.6 1.9 11.9 3.3 3.3 1.4 6 3.4 8.2 6 2.1 2.6 3.2 6.1 3.2 10.5 0 4.2-1.1 8-3.4 11.3-2.2 3.3-5.4 5.9-9.4 7.8-4 1.9-8.6 2.8-13.7 2.8-5.6 0-10.6-1-14.9-3.1-4.3-2-7.6-4.9-10-8.5-2.4-3.6-3.7-7.8-3.7-12.5l11.5.3zM278.5 102.1l11-2.1v14.6h12.6v9.7h-12.6v27.2c0 2 .4 3.5 1.2 4.3.8.9 2.2 1.3 4.2 1.3h8.4v9.7h-10.6c-5 0-8.6-1.2-10.8-3.5-2.2-2.3-3.4-5.9-3.4-10.7v-50.5zM356.8 114.6v52.2h-9.7l-1.2-7.9c-1.8 2.6-4.2 4.7-7 6.2-2.9 1.6-6.2 2.3-10 2.3-4.8 0-9-1.1-12.7-3.2-3.7-2.1-6.7-5.2-8.8-9.3-2.1-4-3.2-8.8-3.2-14.2 0-5.3 1.1-10 3.2-14s5.1-7.2 8.8-9.4c3.7-2.2 7.9-3.3 12.6-3.3 3.9 0 7.2.7 10.1 2.2 2.9 1.5 5.2 3.5 6.9 6.1l1.3-7.6h9.7zm-15.1 38.7c2.8-3.2 4.2-7.3 4.2-12.4 0-5.2-1.4-9.4-4.2-12.6-2.8-3.3-6.5-4.9-11-4.9-4.6 0-8.2 1.6-11 4.8-2.8 3.2-4.2 7.4-4.2 12.5 0 5.2 1.4 9.4 4.2 12.6 2.8 3.2 6.5 4.8 11 4.8s8.2-1.6 11-4.8zM365.5 97.5l11-2.1v71.3h-11V97.5zM380.3 114.6h11.6l11.9 39.9 11.9-39.9h10.1l11.4 39.9 12.3-39.9h11.2l-17.3 52.2h-11.8l-11-35.5-11.4 35.5-11.9.1-17-52.3zM513.7 114.6v52.2H504l-1.2-7.9c-1.8 2.6-4.2 4.7-7 6.2-2.9 1.6-6.2 2.3-10 2.3-4.8 0-9-1.1-12.7-3.2-3.7-2.1-6.7-5.2-8.8-9.3-2.1-4-3.2-8.8-3.2-14.2 0-5.3 1.1-10 3.2-14s5.1-7.2 8.8-9.4c3.7-2.2 7.9-3.3 12.6-3.3 3.9 0 7.2.7 10.1 2.2 2.9 1.5 5.2 3.5 6.9 6.1l1.3-7.6h9.7zm-15.1 38.7c2.8-3.2 4.2-7.3 4.2-12.4 0-5.2-1.4-9.4-4.2-12.6-2.8-3.3-6.5-4.9-11-4.9-4.6 0-8.2 1.6-11 4.8-2.8 3.2-4.2 7.4-4.2 12.5 0 5.2 1.4 9.4 4.2 12.6 2.8 3.2 6.5 4.8 11 4.8 4.6 0 8.2-1.6 11-4.8zM551.3 114.6v10.3h-4.9c-4.6 0-7.8 1.5-9.9 4.4-2 3-3.1 6.7-3.1 11.3v26.2h-11v-52.2h9.8l1.2 7.8c1.5-2.4 3.4-4.4 5.8-5.8 2.4-1.4 5.6-2.1 9.6-2.1h2.5zM556.3 102.1l11-2.1v14.6h12.6v9.7h-12.6v27.2c0 2 .4 3.5 1.2 4.3.8.9 2.2 1.3 4.2 1.3h8.4v9.7h-10.6c-5 0-8.6-1.2-10.8-3.5s-3.4-5.9-3.4-10.7v-50.5z"
      />
      <path
        fill="#db2d54"
        d="M149.1 84.7h-4.8l-44.8 25.9v8.3l44.8 25.9h4.8l44.8-25.9v-8.3l-44.8-25.9zm32.9 30h-35.3V94.4l35.3 20.3zm-35.3 20.4-35.3-20.4 27-15.6v20.2l6.3 3.6h22.9l-20.9 12.2zM99.5 129.9v11l44.8 25.9h4.8l44.8-25.9v-11l-47.2 27.3zM187.3 166.8l6.6-3.8v-11l-25.7 14.8zM99.5 163l6.6 3.8h19.1L99.5 152z"
      />
    </svg>
  );
}

export default function Logo() {
  const { t } = useTranslation();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchLogo() {
      try {
        const response = await fetch(`${getApiBaseUrl()}/logo`, {
          signal: controller.signal,
        });
        const contentType = response.headers.get('content-type') ?? '';

        if (response.ok && contentType.startsWith('image/')) {
          const blob = await response.blob();
          if (!controller.signal.aborted) {
            const url = URL.createObjectURL(blob);
            setLogoUrl(url);
          }
        } else {
          if (!controller.signal.aborted) setFailed(true);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }

    fetchLogo();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (logoUrl) {
        URL.revokeObjectURL(logoUrl);
      }
    };
  }, [logoUrl]);

  if (logoUrl && !failed) {
    return <img src={logoUrl} alt={t('logo.alt', 'Logo')} className="h-7 w-auto max-w-[220px] object-contain" />;
  }

  if (!failed) {
    return <div className="h-7" aria-hidden="true" />;
  }

  return <DefaultLogo />;
}
