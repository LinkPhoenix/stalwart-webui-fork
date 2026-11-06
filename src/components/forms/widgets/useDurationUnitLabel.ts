/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';

export function useDurationUnitLabel(): (unit: string) => string {
  const { t } = useTranslation();
  return (unit: string) => {
    switch (unit) {
      case 'ms':
        return t('duration.milliseconds', 'Milliseconds');
      case 's':
        return t('duration.seconds', 'Seconds');
      case 'min':
        return t('duration.minutes', 'Minutes');
      case 'h':
        return t('duration.hours', 'Hours');
      case 'd':
        return t('duration.days', 'Days');
      default:
        return unit;
    }
  };
}
