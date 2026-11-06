/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';

interface SelectionBannerProps {
  allMatching: boolean;
  pageCount: number;
  total: number | null;
  pluralName: string;
  onSelectAllMatching: () => void;
  onClear: () => void;
}

export function SelectionBanner({
  allMatching,
  pageCount,
  total,
  pluralName,
  onSelectAllMatching,
  onClear,
}: SelectionBannerProps) {
  const { t } = useTranslation();
  const linkClass =
    'font-semibold text-brand-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm';

  if (allMatching) {
    return (
      <div
        role="status"
        className="border-t border-border first:border-t-0 bg-highlight/70 px-5 py-2.5 text-center text-[13px]"
      >
        {t('list.allMatchingSelected', 'All {{total}} {{name}} matching the current filters are selected.', {
          total: total ?? 0,
          name: pluralName,
        })}{' '}
        <button type="button" className={linkClass} onClick={onClear}>
          {t('list.clearSelection', 'Clear selection')}
        </button>
      </div>
    );
  }

  if (total === null || total <= pageCount) return null;

  return (
    <div
      role="status"
      className="border-t border-border first:border-t-0 bg-muted/60 px-5 py-2.5 text-center text-[13px]"
    >
      {t('list.allPageSelected', 'All {{count}} items on this page are selected.', { count: pageCount })}{' '}
      <button type="button" className={linkClass} onClick={onSelectAllMatching}>
        {t('list.selectAllMatchingNamed', 'Select all {{total}} {{name}} matching the current filters', {
          total,
          name: pluralName,
        })}
      </button>
    </div>
  );
}
