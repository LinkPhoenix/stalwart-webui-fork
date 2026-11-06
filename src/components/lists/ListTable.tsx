/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { Column, Field, Schema } from '@/types/schema';
import { isEmptyValue } from '@/lib/embeddedSchema';
import { ListCell } from './ListCell';
import { ColumnHeader, HEADER_CELL } from './ColumnHeader';
import { ListSpinner, ListTableMessage } from './ListStates';
import { itemId, type ListItem } from './listQuery';
import type { ListSort } from './listUrlState';
import type { ListSelection } from './useListSelection';

interface ListTableProps {
  caption: string;
  columns: Column[];
  fields: Record<string, Field>;
  items: ListItem[];
  schema: Schema;
  objectName: string;
  sort: ListSort | null;
  sortable: ReadonlySet<string>;
  onSort: (field: string) => void;
  selection: ListSelection | null;
  rowHref: (id: string) => string | null;
  rowLabel: (item: ListItem) => string;
  renderRowActions: ((item: ListItem, id: string, label: string) => ReactNode) | null;
  loading: boolean;
  busy: boolean;
}

const BODY_CELL = 'px-3.5 py-2.5 first:pl-5 last:pr-5 align-middle';

const STRETCHED_LINK =
  "font-semibold text-foreground hover:underline focus-visible:outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring";

export function ListTable({
  caption,
  columns,
  fields,
  items,
  schema,
  objectName,
  sort,
  sortable,
  onSort,
  selection,
  rowHref,
  rowLabel,
  renderRowActions,
  loading,
  busy,
}: ListTableProps) {
  const { t } = useTranslation();
  const colSpan = columns.length + (selection ? 1 : 0) + (renderRowActions ? 1 : 0);
  const rows = items.flatMap((item) => {
    const id = itemId(item);
    return id ? [{ item, id }] : [];
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-busy={busy || undefined}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {selection && (
              <th scope="col" className="w-10 py-2.5 pl-5 pr-2 text-left align-middle">
                <Checkbox
                  checked={
                    selection.pageState === 'all' ? true : selection.pageState === 'some' ? 'indeterminate' : false
                  }
                  disabled={rows.length === 0}
                  onCheckedChange={selection.togglePage}
                  aria-label={t('list.selectAllOnPage', 'Select all on this page')}
                />
              </th>
            )}
            {columns.map((col) => (
              <ColumnHeader key={col.name} column={col} sortable={sortable.has(col.name)} sort={sort} onSort={onSort} />
            ))}
            {renderRowActions && (
              <th scope="col" className={cn(HEADER_CELL, 'w-12 text-right last:pr-3')}>
                <span className="sr-only">{t('list.actions', 'Actions')}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="border-t border-border px-3 py-12">
                <ListSpinner className="flex items-center justify-center" />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <ListTableMessage colSpan={colSpan}>{t('list.noResults', 'No results found')}</ListTableMessage>
          ) : (
            rows.map(({ item, id }) => {
              const label = rowLabel(item);
              const href = rowHref(id);
              return (
                <tr
                  key={id}
                  className={cn(
                    'relative border-t border-border transition-colors duration-150',
                    selection?.isSelected(id) ? 'bg-highlight/70' : 'hover:bg-muted/55',
                  )}
                >
                  {selection && (
                    <td className="relative z-10 w-10 py-2.5 pl-5 pr-2 align-middle">
                      <Checkbox
                        checked={selection.isSelected(id)}
                        onCheckedChange={() => selection.toggle(id)}
                        aria-label={t('list.selectNamed', 'Select {{label}}', { label })}
                      />
                    </td>
                  )}
                  {columns.map((col, index) => {
                    const value = item[col.name];
                    const content = (
                      <ListCell
                        schema={schema}
                        objectName={objectName}
                        column={col.name}
                        field={fields[col.name]}
                        value={value}
                      />
                    );
                    if (index === 0) {
                      return (
                        <th key={col.name} scope="row" className={cn(BODY_CELL, 'text-left font-normal')}>
                          {href ? (
                            <Link
                              to={href}
                              className={STRETCHED_LINK}
                              aria-label={isEmptyValue(value) ? label : undefined}
                            >
                              {content}
                            </Link>
                          ) : (
                            content
                          )}
                        </th>
                      );
                    }
                    return (
                      <td key={col.name} className={BODY_CELL}>
                        {content}
                      </td>
                    );
                  })}
                  {renderRowActions && (
                    <td className="relative z-10 py-1.5 pl-2 pr-3 text-right align-middle">
                      {renderRowActions(item, id, label)}
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
