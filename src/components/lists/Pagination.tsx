/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PAGE_SIZE_OPTIONS, type PageRange } from './listQuery';

interface PaginationProps {
  range: PageRange;
  total: number | null;
  count: number;
  pluralName: string;
  disabled: boolean;
  pageSize: number;
  onPageSize: (size: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

export function Pagination({
  range,
  total,
  count,
  pluralName,
  disabled,
  pageSize,
  onPageSize,
  onPrev,
  onNext,
}: PaginationProps) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('list.pagination', 'Pagination')}
      className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2.5 pl-5 pr-2.5 text-[13px] text-muted-foreground"
    >
      <p aria-live="polite">
        {total !== null
          ? t('list.showing', 'Showing {{from}}-{{to}} of {{total}} {{name}}', {
              from: range.from,
              to: range.to,
              total,
              name: pluralName,
            })
          : t('list.showingItems', 'Showing {{count}} items', { count })}
      </p>
      <div className="flex items-center gap-1.5">
        <Select
          value={String(pageSize)}
          onValueChange={(value) => {
            const next = Number(value);
            if (PAGE_SIZE_OPTIONS.includes(next)) onPageSize(next);
          }}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 w-[5.5rem]" aria-label={t('list.pageSize', 'Rows per page')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="secondary" size="sm" disabled={!range.hasPrev || disabled} onClick={onPrev}>
          <ChevronLeft aria-hidden />
          {t('list.previous', 'Previous')}
        </Button>
        <Button variant="secondary" size="sm" disabled={!range.hasNext || disabled} onClick={onNext}>
          {t('list.next', 'Next')}
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
