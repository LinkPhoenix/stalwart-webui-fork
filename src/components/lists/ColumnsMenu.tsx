import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Columns3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ListColumns } from '@/hooks/useListColumns';

/** Show/hide and reorder the list's columns (saved per list). */
export function ColumnsMenu({ columns }: { columns: ListColumns }) {
  const { t } = useTranslation();
  const { all, visible, hidden } = columns;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" aria-label={t('list.customizeColumns', 'Customize columns')}>
          <Columns3 aria-hidden />
          {t('list.columns', 'Columns')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto">
        {all.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.name}
            checked={!hidden.has(column.name)}
            disabled={!hidden.has(column.name) && visible.length <= 1}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) => columns.setVisible(column.name, checked === true)}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        {visible.map((column, index) => (
          <DropdownMenuSub key={`order-${column.name}`}>
            <DropdownMenuSubTrigger>{column.label}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem disabled={index === 0} onSelect={() => columns.move(column.name, -1)}>
                <ChevronUp aria-hidden />
                {t('list.moveColumnEarlier', 'Move earlier')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index === visible.length - 1} onSelect={() => columns.move(column.name, 1)}>
                <ChevronDown aria-hidden />
                {t('list.moveColumnLater', 'Move later')}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
