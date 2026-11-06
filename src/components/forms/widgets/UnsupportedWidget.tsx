/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import type { WidgetProps } from '@/components/forms/widgets/types';

export function UnsupportedWidget({ type }: WidgetProps) {
  const { t } = useTranslation();
  return (
    <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
      {t('field.unsupportedType', 'Unsupported field type: {{type}}', { type: (type as { type?: string }).type ?? '' })}
    </p>
  );
}
