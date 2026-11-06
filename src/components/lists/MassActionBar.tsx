/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useTranslation } from 'react-i18next';
import { ChevronUp, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { FloatingActionBar, FloatingActionDivider, FloatingActionDot } from '@/components/common/FloatingActionBar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MassAction } from '@/types/schema';

export type RunnableMassAction = Exclude<MassAction, { type: 'separator' }>;

interface MassActionBarProps {
  actions: { key: string; action: MassAction }[];
  count: number;
  disabled: boolean;
  onSelect: (action: RunnableMassAction) => void;
  onClear: () => void;
}

export function MassActionBar({ actions, count, disabled, onSelect, onClear }: MassActionBarProps) {
  const { t } = useTranslation();
  return (
    <FloatingActionBar>
      <span className="pl-2">
        <FloatingActionDot />
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ink" size="sm" className="text-ink-foreground" disabled={disabled}>
            {t('list.massActionCount', 'Actions ({{count}})', { count })}
            <ChevronUp aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top" sideOffset={10}>
          {actions.map(({ key, action }) =>
            action.type === 'separator' ? (
              <DropdownMenuSeparator key={key} />
            ) : (
              <DropdownMenuItem
                key={key}
                className={
                  action.type === 'delete'
                    ? 'text-destructive focus:bg-destructive-soft focus:text-destructive'
                    : undefined
                }
                onSelect={() => onSelect(action)}
              >
                {action.label}
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <FloatingActionDivider />
      <Button variant="ink" size="icon-sm" onClick={onClear} aria-label={t('list.clearSelection', 'Clear selection')}>
        <X aria-hidden />
      </Button>
    </FloatingActionBar>
  );
}
